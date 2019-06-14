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
【あとで書き換え】  
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
$ docker run -it --name {app name} -p 8080:80 {contaienr name}
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
アプリケーションをデプロイするnamespaceを準備します。  
また、追加したnamespaceで全てのPodにIstioプロキシをサイドカーとして挿入するようにします。
```
xxxx@Azure:~$ kubectl create namespace aksapp
xxxx@Azure:~$ kubectl label namespace aksapp istio-injection=enabled
```

Kubernetesで動作させるためにyamlを作成します。  
Cloud Shellでstep1-create-app.yamlのimage部分を作成したACRへ編集します。
```
    spec:
      containers:
      - name: aks-app
        image: {ACRname}.azurecr.io/aksapp:v1
        imagePullPolicy: Always
```

作成したstep1-create-app.yamlを使ってKubernetesへコンテナアプリケーションをデプロイします。
```
xxxx@Azure:~$ kubectl apply -f step1-create-app.yaml -n aksapp
```

VirtualServiceとGatewayを作成するため、step1-create-gateway.yamlをデプロイします。
```
xxxx@Azure:~$ kubectl apply -f step1-create-gateway.yaml -n aksapp
```

確認するには以下のコマンドを入力します。
```
xxxx@Azure:~$ kubectl get deploy,po,service,gateway,virtualservice -n aksapp
NAME                                DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
deployment.extensions/aks-app-1-0   3         3         3            3           3h30m
deployment.extensions/aks-app-2-0   3         3         3            3           3h29m

NAME                               READY   STATUS    RESTARTS   AGE
pod/aks-app-1-0-7798bbfc69-bxgf6   2/2     Running   0          3h30m
pod/aks-app-1-0-7798bbfc69-gmd95   2/2     Running   0          3h30m
pod/aks-app-1-0-7798bbfc69-vk7dx   2/2     Running   0          3h30m
pod/aks-app-2-0-5b4f9d8c47-8g58m   2/2     Running   0          3h29m
pod/aks-app-2-0-5b4f9d8c47-c7kkm   2/2     Running   0          3h29m
pod/aks-app-2-0-5b4f9d8c47-zhhkr   2/2     Running   0          3h29m

NAME              TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE
service/aks-app   ClusterIP   10.0.xxx.xx   <none>        80/TCP    3h30m

NAME                                          AGE
gateway.networking.istio.io/aks-app-gateway   3h

NAME                                         GATEWAYS            HOSTS   AGE
virtualservice.networking.istio.io/aks-app   [aks-app-gateway]   [*]     3h
```

アプリケーションへアクセスするためのIPアドレスは以下コマンドで調べられます。
```
xxxx@Azure:~$ kubectl get service istio-ingressgateway --namespace istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
xxx.xxx.xxx.xxx%
```
表示されたIPアドレスでアプリケーションが表示されるか確認します。

## 2-4. カナリアリリースの実装
先ほど作ったアプリケーションを変更し、異なるバージョンを作成します。  
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

Cloud Shellでstep2-update-app.yamlのimage部分を作成したACRへ編集します。
```
    spec:
      containers:
      - name: aks-app
        image: {ACRname}.azurecr.io/aksapp:v2
        imagePullPolicy: Always
```

新しいバージョンのアプリケーションをデプロイします。
```
xxxx@Azure:~$ kubectl apply -f step2-update-app.yaml -n aksapp
```

2つのバージョンを表示させるため、VirtualServiceを変更します。
```
xxxx@Azure:~$ kubectl apply -f step2-update-gateway.yaml -n aksapp
```

比率を変更する場合はweightの値を変更します。
```
    - destination:
        host: aks-app.aksapp.svc.cluster.local
        subset: v1
        port:
          number: 80
      weight: 80
    - destination:
        host: aks-app.aksapp.svc.cluster.local
        subset: v2
        port:
          number: 80
      weight: 20
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
Path to publishでdeployment.yamlを選択、Artifact nameではyamlと入力し、Saveします。  

### 3-4. リリースの作成
Releasesを開き、New pipelineをクリックします。  
Deploy to a Kubernetes clusterをApplyします。  
Stageは×で閉じ、Add an artifactをクリックし、3-3で作成したBuildをSourceに選んでAddします。  
右上の丸雷アイコンをクリックし、Continuous deployment triggerをEnabledにします。  
Build branch filtersをAddしてBuild branchをmasterにします。  
Stage 1の下にある「1 job, 1task」をクリックし、kubectlを選択します。  
Kubernets service connectionは+newをクリックし、Azure Subscriptionから対象のAKSクラスタを選択します。 
Namespaceにはaksappを選択します。  
画面が戻るのでNamespaceにaksappを入力し、Commandはapplyを選択してUse Configuration filesにチェックを入れてdeployment.yamlを選択する。  
SaveしてOKする。  

### 3-5. パイプラインの実行
Pipelineを開き、Ar


## 4. リソースの削除
### 4-1. Kubernetesリソースの削除
対象のnamespaceを削除することで使用したアプリをAKSクラスターから削除できます。
```
xxxx@Azure:~$ kubectl delete namespace aksapp
```

### 4-2. Azure リソースの削除
Azure Portal[https://portal.azure.com/]より1-1で作成したリソースグループを削除する。  
```
xxxx@Azure:~$ az group delete --name {ResourceGroup}
```

### 4-3. Azure DevOpsリソースの削除
Azure DevOps[https://dev.azure.com/]より3-2で作成したプロジェクトを削除する。

