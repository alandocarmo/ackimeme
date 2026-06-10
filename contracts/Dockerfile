FROM ubuntu:22.04

RUN apt-get update && apt-get install -y wget tar libssl-dev xz-utils curl

# 1. Instalar o Compilador (Sold)
RUN wget https://github.com/gosh-sh/TVM-Solidity-Compiler/releases/download/gosh_0.79.3/sold_gosh_0.79.3_linux_x86_64.tar.gz -O compiler.tar.gz
RUN tar -xvzf compiler.tar.gz && rm compiler.tar.gz
RUN find . -maxdepth 1 -type f -executable -exec mv {} /usr/local/bin/solc \;

# 2. Instalar o tvm-cli (Acki Nacki SDK)
RUN wget https://github.com/tvmlabs/tvm-sdk/releases/download/v2.24.16.an/tvm-cli-2.24.16.an-linux-musl-amd64.tar.gz -O tvm-cli.tar.gz
RUN tar -xvzf tvm-cli.tar.gz && rm tvm-cli.tar.gz
RUN mv tvm-cli /usr/local/bin/tvm-cli && chmod +x /usr/local/bin/tvm-cli

WORKDIR /contracts
COPY . .

# Compile all contracts automatically
CMD ["sh", "-c", "\
echo '=== Compiling AFTWallet.sol ===' && \
solc AFTWallet.sol --tvm-version gosh 2>&1 && \
mv AFTWallet.abi.json TokenWallet.abi.json && \
mv AFTWallet.tvc TokenWallet.tvc && \
echo '' && \
echo '=== Compiling AFTRoot.sol ===' && \
solc AFTRoot.sol --tvm-version gosh 2>&1 && \
mv AFTRoot.abi.json TokenRoot.abi.json && \
mv AFTRoot.tvc TokenRoot.tvc && \
echo '' && \
echo '=== Compiling BondingCurve.sol ===' && \
solc BondingCurve.sol --tvm-version gosh 2>&1 && \
echo '' && \
echo '=== Compiling USDCShellRouter.sol ===' && \
solc USDCShellRouter.sol --tvm-version gosh 2>&1 && \
echo '' && \
echo '=== Compiling AckiSwapFactory.sol ===' && \
solc amm/AckiSwapFactory.sol --tvm-version gosh 2>&1 && \
echo '' && \
echo '=== Compiling AckiSwapPair.sol ===' && \
solc amm/AckiSwapPair.sol --tvm-version gosh 2>&1 && \
echo '' && \
echo '=== Compilation complete ===' && \
ls -la *.abi.json *.tvc 2>/dev/null \
"]
