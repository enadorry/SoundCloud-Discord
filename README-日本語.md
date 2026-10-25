# SoundCloud → Discord

WindowsのChrome／Edgeで聴いているSoundCloudの曲を、Discordデスクトップ版のプロフィールの「アクティビティ」に表示するプログラムです。
曲名、投稿者名、ジャケット画像、再生時間、SoundCloudへのボタンに対応します。投稿者名は楽曲の実際の歌手名と異なる場合があります。
カスタムステータスの文章欄を書き換えるものではありません。

## はじめ方（初回のみ、約5分）

1. ZIPを右クリックして「すべて展開」します。ZIP内から直接起動しないでください。
2. Discordデスクトップ版を起動します。ブラウザー版Discordでは連携できません。
3. `START.cmd` をダブルクリックします。設定画面が開きます。開かない場合は http://127.0.0.1:32145 を開いてください。
   - Node.js 20以上が必要です。未導入の場合は https://nodejs.org/ のLTS版を導入してください。
   - このPCでは作成時点でNode.js 24.21.0を確認しました。
4. https://discord.com/developers/applications で「New Application」を選び、名前を `SoundCloud` にします。
5. 「General Information」の **Application ID** をコピーし、設定画面に貼り付けて「保存・接続」を押します。
   - Botの作成・サーバーへの招待・ユーザートークン・Client Secretは不要です。
6. Chromeなら `chrome://extensions`、Edgeなら `edge://extensions` を開き、「デベロッパーモード」をオンにします。
7. 「パッケージ化されていない拡張機能を読み込む」を押し、このフォルダー内の **extension フォルダー** を選びます。
8. 拡張機能一覧／ツールバーの「SoundCloud → Discord Local」をクリックします。設定画面のペアリングキーを貼り付けて「保存」します。
9. SoundCloudのタブを再読み込みし、曲を再生してください。
10. Discordの「ユーザー設定 → アクティビティのプライバシー」で、現在のアクティビティを共有する設定を有効にしてください。名称はDiscordのバージョンにより異なります。

## 次回から

Discordを起動 → `START.cmd` をダブルクリック → SoundCloudで再生するだけです。
設定は自動保存されます。プログラムのウィンドウは開いたままにしてください。
終了はそのウィンドウで **Ctrl+C**。終了時にアクティビティを消します。

## 動き方

- 曲名・投稿者名・再生位置をブラウザー拡張機能から同じPCのプログラムに送ります。
- 送信先は `127.0.0.1:32145` のみです。Discordへの更新はPC内のIPCを使います。
- 曲の変更や一時停止を約2秒おきに確認します。再生時間の補正・シークの反映は通常10秒程度です。
- 一時停止すると表示を消します。タブを閉じたり、拡張機能との通信が止まると最大90秒で消します。
- 複数のSoundCloudタブが再生している場合は、最後に再生を開始したタブを優先します。
- Discordを再起動した場合も、自動で再接続します。
- 設定画面の「Discordに表示する」をオフにして保存すると、一時的に共有を停止できます。

## 表示されないとき

- 設定画面のDiscord接続状態を確認してください。Application IDは数字のみで入力します。
- 拡張機能のポップアップにエラーが出ていないか確認します。キーが一致しない場合は貼り直します。
- 拡張機能を追加・更新した直後は、SoundCloudのタブを再読み込みしてください。
- Discordのアクティビティ共有設定を有効にし、オンラインの状態で確認してください。
- ブラウザーの省メモリ機能でSoundCloudタブが休止される場合、そのサイトを休止対象から除外してください。
- 連携プログラムは1つだけ起動してください。
- 非公開曲のURLは、その曲へのアクセス権がある人だけが再生できます。共有ボタンにはURLのクエリや秘密キーを含めません。

## 対応範囲と確認状況

- Windows + Chrome／Edge + SoundCloudの通常サイト + Discordデスクトップ版を対象にしています。
- スマートフォン、Firefox、SoundCloudの埋め込みプレイヤー、ブラウザー版Discordは対象外です。
- SoundCloudの画面から再生情報を読むため、同サイトの画面変更により修正が必要になる可能性があります。
- 自動テスト10件に合格しました。曲情報の読み取り用画面データ、停止、複数タブ、通信制限、実際のWindows名前付きパイプを使う模擬Discord、再接続、PC内HTTP通信を検証しています。
- 実際のSoundCloudタブとDiscordプロフィールでの表示は、拡張機能の導入と本人のApplication IDの設定後に確認する必要があります。

## ファイル

- START.cmd：起動用
- app.mjs / lib.mjs：連携プログラム
- panel.html / panel.js：日本語の設定画面
- extension/：ブラウザー拡張機能
- tests/：自動テスト。フォルダー内で `npm test` を実行できます。
- config.json：初回起動時に生成される、このPCの設定。ペアリングキーを含むため共有しないでください。

追加のnpmパッケージは使っていません。ソースコードを同梱しています。

参考資料：
- Discord RPC: https://discord.com/developers/docs/topics/rpc
- Chrome拡張機能の通信: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

## 1.0.2：曲名とジャケット画像の表示

- Discordの短いステータスにも曲のタイトルを表示します。
- プロフィールのアクティビティカードに、SoundCloudのジャケット画像を表示します。
- 設定画面でも取得したジャケット画像を確認できます。
- ジャケットが取得できない曲では画像を表示しません。前の曲の画像は引き継ぎません。
- Discord側の画像取得・キャッシュにより、画像の反映に時間がかかる場合があります。

### 以前の版から更新する場合

1. 起動中の連携プログラムをCtrl+Cで終了します。
2. 新しいZIPを展開し、同じフォルダーのファイルに上書きします。既存のconfig.jsonはそのまま残してください。更新ZIPには含めていません。
3. chrome://extensions または edge://extensions で「SoundCloud → Discord Local」の再読み込みボタンを押します。
4. 開いているSoundCloudタブも再読み込みします。
5. START.cmdを起動し、SoundCloudで曲を再生してください。

保存済みのApplication IDとペアリングキーは引き続き使えます。別フォルダーへ移した場合は、拡張機能の読み込み先も更新してください。

曲名・画像URLの取得とDiscordへの送信内容は自動テストで検証済みです。実際のSoundCloudとDiscordプロフィールでの表示は、更新後に確認してください。

公式仕様：
- ステータス表示：https://discord.com/developers/docs/discord-social-sdk/development-guides/setting-rich-presence#configuring-status-text
- 画像：https://discord.com/developers/docs/discord-social-sdk/development-guides/setting-rich-presence#uploading-assets
