pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

contract NftItem {
    address static _collection;
    uint256 static _id;

    address public owner;
    string public jsonMetadata;

    constructor(address _owner, string _jsonMetadata) {
        require(msg.sender == _collection, 100, "Only collection can mint");
        tvm.accept();
        owner = _owner;
        jsonMetadata = _jsonMetadata;
    }

    function transfer(address to) external {
        require(msg.sender == owner, 101, "Not the owner");
        tvm.accept();
        owner = to;
    }

    function getInfo() external view returns (address collection, uint256 id, address itemOwner, string metadata) {
        return (_collection, _id, owner, jsonMetadata);
    }
}
