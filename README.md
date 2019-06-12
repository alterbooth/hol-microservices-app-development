# hol-microservices-app-development
マイクロサービスアプリケーション開発講座

# マイクロサービスアプリケーション開発　ハンズオン
## 事前作業
* Microsoft Azureサブスクリプションの取得
* Visual Studio Codeインストール
* Dockerインストール

## 利用するプロダクトのバージョン
* Kubernetes(AKS) : 1.12.8
* Istio : 1.1.7
* Jeager : 1.8
  

## 1. 環境構築
### 1-1. Azure Kubernetes Service(AKS)の構築
Azure Portal[https://portal.azure.com/]へログインします。  
まず始めにAzure PortalよりCloud Shellを起動します。  
リソースグループを作成し、作成したリソースグループへAKSを構築します。  
```
xxxx@Azure:~$ az group create --name {ResourceGroup} --location japaneast
xxxx@Azure:~$ az aks create \
                  --resource-group {ResourceGroup} \
                  --name {AKSname} \
                  --node-count 2 \
                  --enable-addons monitoring \
                  --generate-ssh-keys
```

### 1-2. Azure Container Registry(ACR)の構築
後述するアプリケーションのコンテナレジストリとしてACRを構築します。  
```
xxxx@Azure:~$ az acr create --resource-group {ResourceGroup} --name {ACRname} --sku Basic --admin-enabled true
```
また、AKSクラスターへのアクセス許可を以下のシェルスクリプトで付与します。
```
#!/bin/bash

AKS_RESOURCE_GROUP={ResourceGroup}
AKS_CLUSTER_NAME={AKSname}
ACR_RESOURCE_GROUP={ResourceGroup}
ACR_NAME={ACRname}

# Get the id of the service principal configured for AKS
CLIENT_ID=$(az aks show --resource-group $AKS_RESOURCE_GROUP --name $AKS_CLUSTER_NAME --query "servicePrincipalProfile.clientId" --output tsv)

# Get the ACR registry resource id
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $ACR_RESOURCE_GROUP --query "id" --output tsv)

# Create role assignment
az role assignment create --assignee $CLIENT_ID --role acrpull --scope $ACR_ID
```

### 1-3. サービスメッシュ実装  
サービスメッシュを実現するために、Istioを実装します。  
まず始めにAzure PortalよりCloud Shellを起動します。  
「Bash」を選択し、Create storageをクリックします。  
以下コマンドを投入し、クレデンシャル情報を取得します。  
Istioをインストールします。
```
xxxx@Azure:~$ az aks get-credentials -g {ResourceGroup} -n {AKSname}
xxxx@Azure:~$ curl -L https://git.io/getLatestIstio | ISTIO_VERSION=1.1.7 sh -
xxxx@Azure:~$ cd istio-1.1.7
xxxx@Azure:~$ export PATH=$PWD/bin:$PATH
xxxx@Azure:~$ for i in install/kubernetes/helm/istio-init/files/crd*yaml; do kubectl apply -f $i; done
xxxx@Azure:~$ kubectl apply -f install/kubernetes/istio-demo.yaml
```
※項1で構築したAKSのResource GroupとResouce Nameを使用します。

Istioのインストール確認をします。
```
xxxx@Azure:~$ kubectl get po -n istio-system
NAME                                      READY   STATUS      RESTARTS   AGE
grafana-77b49c55db-bdbs2                  1/1     Running     0          23m
istio-citadel-66d49b64fc-9jw2z            1/1     Running     0          23m
istio-cleanup-secrets-1.1.7-vrtqh         0/1     Completed   0          23m
istio-egressgateway-68d9cfdd4-z7nsv       1/1     Running     0          23m
istio-galley-676599ffb4-jxprm             1/1     Running     0          23m
istio-grafana-post-install-1.1.7-jrwjx    0/1     Completed   0          23m
istio-ingressgateway-7fbf7bcf45-clwrp     1/1     Running     0          23m
istio-pilot-56b4dd7bd7-fpdqn              2/2     Running     0          23m
istio-policy-7bcc6d45df-ssdzv             2/2     Running     2          23m
istio-security-post-install-1.1.7-sc95j   0/1     Completed   0          23m
istio-sidecar-injector-779544894b-8tvj8   1/1     Running     0          23m
istio-telemetry-d6f5cd5d9-2759p           2/2     Running     3          23m
istio-tracing-595796cf54-vv2bv            1/1     Running     0          23m
kiali-5c584d45f6-h6nn7                    1/1     Running     0          23m
prometheus-5fffdf8848-gwrbg               1/1     Running     0          23m
```

### 1-4. 分散トレーシング
分散トレーシングを実現するために、Jaegerを実装します。
```
xxxx@Azure:~$ kubectl apply -n istio-system -f https://raw.githubusercontent.com/jaegertracing/jaeger-kubernetes/master/all-in-one/jaeger-all-in-one-template.yml
```

コンソールへのアクセスURLは以下コマンドでIPアドレスを参照し、ブラウザでアクセスします。
```
xxxx@Azure:~$ kubectl get service jaeger-query -n istio-system
NAME           TYPE           CLUSTER-IP    EXTERNAL-IP     PORT(S)        AGE
jaeger-query   LoadBalancer   10.0.0.0   xxx.xxx.xxx.xxx   80:31742/TCP   111s
```
アプリケーションへの実装は後述します。

## 2. アプリケーション開発
### 2-1. マイクロサービスなアプリケーションの開発
【あとで書き換え】
以下コマンドにてMVCアプリケーションを作成し、動作確認する。
```
$ dotnet new mvc -o {AppName}
$ cd {AppName}
$ dotnet run
```

### 2-2. アプリケーションのコンテナ化
前項で作成したアプリケーションをコンテナ化します。  
アプリケーションのソースディレクトリにてDockerfileを作成します。
```
FROM mcr.microsoft.com/dotnet/core/sdk:2.2

WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /app

ENTRYPOINT [ "dotnet", "{app name}".dll" ]
```

出来上がったらdocker buildしてみて動作するかを検証します。
```
$ docker build ./ -t xxxxx
$ docker run -it --name {app name} -p {port}:{port} {contaienr name}
```

動作確認が完了したらACRへコンテナイメージをプッシュします。  
まずはAzure PortalでContainer registryAccess keysよりLogin serverとUsername/passwordを確認します。  
次に、作成したコンテナイメージのタグをACRへプッシュするため変更し、ACRへログインしてプッシュします。
```
$ docker tag {app name} {ACR Login server}/{app name}:v1
$ docker login {ACR Login server}
$ docker push {ACR Login server}/{app name}:v1
```

### 2-3. kubernetes Deploymentの作成
【あとで書き換え】  
Kubernetesで動作させるためにyamlを作成します。  
Cloud Shellでdeployment.yamlを以下のように作成します。
```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aks-deployment
  labels:
    app: aksapp
spec:
  replicas: 5
  selector:
    matchLabels:
      app: aksapp
  template:
    metadata:
      labels:
        app: aksapp
    spec:
      containers:
      - name: aksapp
        image: {ACR Login server}/{app name}:v1
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: aksapp
spec:
  type: LoadBalancer
  ports:
  - port: 80
  selector:
    app: aksapp
```

作成されたdeployment.yamlを使ってKubernetesへコンテナアプリケーションをデプロイします。
```
xxxx@Azure:~$ kubectl apply -f <(/usr/local/bin/istioctl kube-inject -f ./deployment.yaml)
```

確認するには以下のコマンドを入力します。
```
xxxx@Azure:~$ kubectl get deploy,po,service
NAME                                   DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
deployment.extensions/aks-deployment   5         5         5            5           3m36s

NAME                                  READY   STATUS    RESTARTS   AGE
pod/aks-deployment-65949499bc-5nh8b   2/2     Running   0          3m36s
pod/aks-deployment-65949499bc-5t5fc   2/2     Running   0          3m36s
pod/aks-deployment-65949499bc-fxjpz   2/2     Running   0          3m36s
pod/aks-deployment-65949499bc-kktgx   2/2     Running   0          3m36s
pod/aks-deployment-65949499bc-n8v7w   2/2     Running   0          3m36s

NAME                 TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)        AGE
service/aksapp       LoadBalancer   10.0.xxx.xxx   xx.xxx.xx.xxx   80:31369/TCP   3m36s
service/kubernetes   ClusterIP      10.0.0.1       <none>          443/TCP        3h7m
```


## 2-4. カナリアリリースの実装
【あとで書き換え】  
先ほど作ったアプリケーションを変更し、異なるバージョンを作成します。  
まず初めに先ほどのコンテナアプリを削除します。
```
xxxx@Azure:~$ kubectl delete -f deployment.yaml
```

Views/HomeIndex.cshtmlを編集し、コンテナ化します。
出来上がったら先ほどと同様にdocker buildしてみて動作するかを検証します。
```
$ docker build ./ -t xxxxx
$ docker run -it --name {app name} -p {port}:{port} {contaienr name}
```

動作に問題なければACRへバージョンタグを変更してプッシュします。
```
$ docker tag {app name} {ACR Login server}/{app name}:v2
$ docker push {ACR Login server}/{app name}:v2
```

2つのバージョンを表示するためKubernetes用deployments.yamlを作成します。
```

```


## 3. パイプラインの作成
前項までに作成したアプリケーションのCI/CDパイプライン実装を行います。  
### 3-1. プロジェクトの作成
Azure DevOps[https://dev.azure.com/]へサインインします。  

プロジェクト名を入力し、Create projectをクリックします。  

### 3-2. リポジトリの作成
Reposを開き、リポジトリのURLを取得して項5で作成したアプリケーションのディレクトリにて以下コマンドを入力してリモートリポジトリを登録してプッシュします。
```
git remote add origin https://xxxxx@dev.azure.com/xxxxx/xxxx/_git/xxxx
git push -u origin --all
```

### 3-3. ビルドの作成
Pipelinesを開き、New pipelineをクリックします。  
Use the classic editorをクリックし、Azure Repos Gitにて先ほどプッシュしたリポジトリが選択されていることを確認し、Continueをクリックします。  
Docker containerをApplyします。
Build an imageとPush an imageにて6.1で作成したレジストリをそれぞれAzure subscriptionとAzure container Registryで選択します。  
+をクリックし、Bash Scriptを追加。  
TypeをInlineにしてScriptを以下のようにします。
```
# Write your commands here

sed -i -e s/latest/$(Build.BuildNumber)/g $(Build.SourcesDirectory)/deployment.yaml

cat $(Build.SourcesDirectory)/deployment.yaml

# Use the environment variables input below to pass secret variables to this script
```
Publish Artifactを追加し、deployment.yamlを選択します。


### 3-4. リリースの作成

## 4. リソースの削除
### 4-1. Azure リソースの削除
Azure Portal[https://portal.azure.com/]より1-1で作成したリソースグループを削除する。  

### 4-2. Azure DevOpsリソースの削除
Azure DevOps[https://dev.azure.com/]より3-2で作成したプロジェクトを削除する。

