# GitLab Auth Proxy

オンプレミスのGitLab向けに、GitLabでログイン(またはパーソナルアクセストークンを保持)している場合のみ表示可能なページを運用する為のProxyです。\
GitLabの認証をチェックしてからProxy(転送)することができます。

オンプレミスのGitLab用に用意したPlantUMLサーバーを、GitLabユーザーのみが利用可能なように制限したくて作ったものになります。

下記GitLabの手順通りPlantUMLサーバーを用意すると、PlantUMLサーバー自体は誰でもアクセス可能な状態となってしまうので。
https://docs.gitlab.com/ee/administration/integration/plantuml.html

- [GitLab Auth Proxy](#gitlab-auth-proxy)
- [利用方法](#利用方法)
  - [ソースの取得](#ソースの取得)
  - [ビルド](#ビルド)
  - [設定ファイル(`conf.json`)を作成](#設定ファイルconfjsonを作成)
    - [サンプル設定](#サンプル設定)
  - [起動](#起動)
- [利用例](#利用例)


# 利用方法

## ソースの取得

下記の通りGitでCloneしてください。

```sh
git clone https://github.com/playree/gitlab-auth-proxy.git
```

## ビルド

Node.jsで作られていますので、下記の通りビルドしてください。

```sh
cd gitlab-auth-proxy
yarn install
yarn build
```

## 設定ファイル(`conf.json`)を作成

プロジェクト直下に`conf.json`を作成します。\
`conf.sample.json`がサンプルになります。

```json
{
  "port": 3000,
  "gitlabUrl": "https://gitlab.sample.dev/",
  "proxies": [
    {
      "label": "plantuml",
      "target": "http://localhost:8081"
    }
  ]
}
```

- `port`\
  プロキシとして待ち受けるポートを指定します。
- `gitlabUrl`\
  GitLabのURLを指定します。\
  GitLabと同じサーバー内で稼働するなら`localhost`指定でも良いはず。
- `proxies / label`\
  振り分けに利用するラベルを指定します。
- `proxies / target`\
  プロキシ(転送)先を指定します。

### サンプル設定

上記サンプルの場合、本モジュールはポート3000で待ち受けるように起動し、

- GitLabのセッションCookieを利用する場合\
  `http://localhost:3000/plantuml/-/abc`
- Personal Access Tokenを利用する場合\
  `http://localhost:3000/plantuml/tkn/{Personal Access Token}/-/abc`

にアクセスされると
`http://localhost:8081/abc`
にプロキシ(転送)します。

この際、`https://gitlab.sample.dev/`に対して認証を行い、\
GitLabのセッションCookieまたは、指定したPersonal Access Tokenが有効な場合のみプロキシ(転送)されます。

つまり、GitLabにログインしているユーザーのみ、PlantUMLサーバーを利用可能にするなどができます。

## 起動

```sh
./ga-proxy.sh
```

引数として設定ファイルを指定することもできます。\
指定しない場合は(デフォルトでは)プロジェクト直下に用意した`conf.json`が利用されます。

# 利用例

オンプレミスのGitlabと同じサーバー内にPlantUMLサーバーを用意して運用。\
そこに本モジュールを組み込んでPlantUMLサーバーに認証を追加する。

基本的に下記手順で用意する場合。\
https://docs.gitlab.com/ee/administration/integration/plantuml.html

1. GitLabはポート80で起動中。
2. PlantUMLサーバーをポート8081で起動。(Dockerなどで)
3. 本プロキシを下記設定で起動。
    ```json
    {
      "port": 3000,
      "gitlabUrl": "http://localhost",
      "proxies": [
        {
          "label": "plantuml",
          "target": "http://localhost:8081"
        }
      ]
    }
    ```
4. GitLabのNginx設定に下記を追加\
   GitLabのNginxで受けた`/-/plantuml/`のアクセスを本プロキシに転送する設定。
    ```conf
    location /-/plantuml/ { 
      rewrite ^/-/plantuml/(.*) /plantuml/$1 break;
      proxy_cache off; 
      proxy_pass http://localhost:3000/;
    }
    ```
5. 本プロキシは`/plantuml/`で受けた内容を、GitLabの認証をチェックしてからPlantUMLサーバーに転送する。
