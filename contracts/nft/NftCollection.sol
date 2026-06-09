pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./NftItem.sol";

contract NftCollection {
    address static _owner;
    TvmCell static _nftItemCode;

    uint256 public totalSupply;
    
    event NftMinted(uint256 id, address owner, string metadata);

    constructor() {
        require(msg.pubkey() == tvm.pubkey(), 100);
        tvm.accept();
    }

    function mintCreatorBadge(address creator, string tokenTicker, string tokenImage) external {
        require(msg.sender == _owner, 101);
        tvm.accept();

        uint256 id = totalSupply;
        totalSupply++;

        string metadata = '{"name":"Ackimeme Creator: ';
        metadata.append(tokenTicker);
        metadata.append('","description":"Official Creator Badge","image":"');
        metadata.append(tokenImage);
        metadata.append('"}');

        TvmCell stateInit = abi.encodeStateInit({
            contr: NftItem,
            varInit: {
                _collection: address(this),
                _id: id
            },
            code: _nftItemCode
        });

        address nft = new NftItem{
            stateInit: stateInit,
            value: 0.5 ever,
            flag: 0,
            bounce: false
        }(creator, metadata);

        emit NftMinted(id, creator, metadata);
    }

    function resolveNft(uint256 id) external view returns (address) {
        TvmCell stateInit = abi.encodeStateInit({
            contr: NftItem,
            varInit: {
                _collection: address(this),
                _id: id
            },
            code: _nftItemCode
        });
        return address.makeAddrStd(0, tvm.hash(stateInit));
    }
}
