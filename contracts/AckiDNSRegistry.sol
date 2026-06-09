pragma tvm-solidity >= 0.76.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

contract AckiDNSRegistry {
    // Basic DNS Registry mapping `nameHash` to `TokenRoot`

    address static _owner;
    
    uint128 public constant REGISTRATION_FEE = 1000 * 1e9; // 1,000 SHELL ($10)
    
    mapping(uint256 => address) public domains;
    
    event DomainRegistered(string name, address tokenRoot, address owner);

    constructor() {
        require(msg.pubkey() == tvm.pubkey(), 100);
        tvm.accept();
    }

    function registerDomain(string name, address tokenRoot) external {
        // Require the fee to be attached
        require(msg.value >= REGISTRATION_FEE, 101, "Insufficient registration fee");
        
        tvm.rawReserve(0, 4); // Keep all balance before this message

        uint256 nameHash = tvm.hash(name);
        require(!domains.exists(nameHash), 102, "Domain already registered");
        require(tokenRoot != address(0), 103, "Invalid token root");
        
        domains[nameHash] = tokenRoot;
        
        emit DomainRegistered(name, tokenRoot, msg.sender);
        
        // Send excess gas back
        msg.sender.transfer({value: 0, flag: 128, bounce: false});
    }

    function resolveDomain(string name) external view returns (address) {
        uint256 nameHash = tvm.hash(name);
        if (domains.exists(nameHash)) {
            return domains[nameHash];
        }
        return address(0);
    }
}
