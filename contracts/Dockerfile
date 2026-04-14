FROM ubuntu:22.04

RUN apt-get update && apt-get install -y wget tar libssl-dev xz-utils

# Baixa o binário oficial do compilador TVM da release gosh_0.79.3 Linux
RUN wget https://github.com/gosh-sh/TVM-Solidity-Compiler/releases/download/gosh_0.79.3/sold_gosh_0.79.3_linux_x86_64.tar.gz -O compiler.tar.gz
RUN tar -xvzf compiler.tar.gz && rm compiler.tar.gz

# O conteúdo do tar.gz costuma trazer 'solc' ou binários equivalentes e algumas libs.
# Para evitar ficar perdido onde ele descompactou, jogamos tudo pro bin:
RUN find . -maxdepth 1 -type f -executable -exec mv {} /usr/local/bin/solc \;

WORKDIR /contracts

# Ponto de entrada assume que a pasta contracts/ local vai ser montada aqui
CMD ["sh", "-c", "echo 'Compilando Smart Contracts (TVM)...' && solc ./TokenRoot.sol && solc ./TokenWallet.sol && solc ./BondingCurve.sol && echo 'Compilação terminada. Arquivos gerados disponíveis no host.'"]
