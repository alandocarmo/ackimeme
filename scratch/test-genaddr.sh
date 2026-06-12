#!/bin/sh
# Teste: tvm-cli aceita setar statics via --data com ABIs sem secao "data"?
echo "=== TokenRoot com --data (statics _deployer/_name/_symbol/_decimals) ==="
tvm-cli genaddr /repo/contracts/build/TokenRoot.tvc \
  --abi /repo/contracts/build/TokenRoot.abi.json \
  --genkey /tmp/test.keys \
  --data '{"_deployer":"0:0000000000000000000000000000000000000000000000000000000000000000","_name":"TestCoin","_symbol":"TST","_decimals":"9"}'
echo "EXIT: $?"
echo ""
echo "=== AckiSwapFactory com --data (statics _owner/_pairCode omitido) ==="
tvm-cli genaddr /repo/contracts/build/AckiSwapFactory.tvc \
  --abi /repo/contracts/build/AckiSwapFactory.abi.json \
  --genkey /tmp/test2.keys \
  --data '{"_owner":"0:0000000000000000000000000000000000000000000000000000000000000000"}'
echo "EXIT: $?"
