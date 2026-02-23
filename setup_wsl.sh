#!/bin/bash
set -e

# カラー出力用の設定
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}WSLセットアップを開始します...${NC}"

# 1. 基本ツールのインストール
echo "パッケージリストを更新中..."
sudo apt-get update
sudo apt-get install -y curl wget unzip git build-essential

# 2. Node.js (nvm) のインストール
if ! command -v node &> /dev/null; then
    echo -e "${GREEN}Node.js (nvm) をインストール中...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    
    # パスの設定を現在のシェルに反映
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # 最新のLTS版をインストール
    nvm install --lts
    nvm use --lts
    
    echo "Node.js $(node -v) がインストールされました"
else
    echo "Node.js は既にインストールされています: $(node -v)"
fi

# 3. Supabase CLI のインストール
if ! command -v supabase &> /dev/null; then
    echo -e "${GREEN}Supabase CLI をインストール中...${NC}"
    # 特定のバージョンを指定してダウンロード (安定版)
    CLI_VERSION="1.145.4"
    wget -q https://github.com/supabase/cli/releases/download/v${CLI_VERSION}/supabase_${CLI_VERSION}_linux_amd64.tar.gz -O supabase.tar.gz
    tar -xzf supabase.tar.gz
    sudo mv supabase /usr/local/bin/
    rm supabase.tar.gz
    echo "Supabase CLI がインストールされました"
else
    echo "Supabase CLI は既にインストールされています"
fi

echo -e "${GREEN}セットアップが完了しました！${NC}"
echo -e "${GREEN}重要: 以下のコマンドを実行して、環境変数を反映させてください:${NC}"
echo ""
echo "source ~/.bashrc"
echo ""
