// init nodes by running docker-compose up
// wait for 10 secs for nodes to be started
// deploy contracts: 

const ethers = require("ethers")
const axios = require("axios")
const config = require("./config/config.json")
const { tokenABI } = require("./contracts/abi")
const { tokenBytecode } = require("./contracts/bytecodes")
const { oracleABI } = require("./contracts/abi")
const { oracleBytecode } = require("./contracts/bytecodes")


const connectAndGetProvider = async () => {
    const provider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:6690")
    return provider
}

const getKnownSigner = async (provider) => {
    const knownSigner = ethers.Wallet.fromMnemonic(config.mnemonic).connect(provider)
    return knownSigner
}

const getAddressFunder = (provider, startingIndex=2) => {
    let currentIndex = startingIndex
    return async (address, etherValue=80) => {
        try {
            console.log("funding ====================>>>",{address})
            await provider.getSigner(currentIndex).sendTransaction({
                value: ethers.utils.parseEther(String(etherValue)),
                to: address
            })
            currentIndex +=1
        } catch (error) {
            console.log("error funding address", error)
        }
    }
}

const deployChainlinkToken = async (signer) => {
    const factory = new ethers.ContractFactory(tokenABI, tokenBytecode, signer)
    const contract = await factory.deploy()
    await contract.deployTransaction.wait()
    return contract
}

const setupChainlinkOracle = async (signer, linkToken, nodeAddress) => {
    const factory = new ethers.ContractFactory(oracleABI, oracleBytecode, signer)
    const contract = await factory.deploy(linkToken)
    await contract.deployTransaction.wait()
    await contract.setFulfillmentPermission(nodeAddress, true)
    return contract
}

const sleep = (seconds) => {
    return new Promise(resolve => setTimeout(resolve, seconds*1000));
}

const getNodeAddress = async (delay=5) =>{
    const queryNodeAddress = async () => {
        try {
            let res = await axios.post("http://localhost:6688/sessions", {email:"user@mail.com", password:"password"}, {withCredentials: true})
            res = await axios.get("http://localhost:6688/v2/user/balances", {headers: {Cookie: res.headers['set-cookie'].join("; ")}})
            const nodeAddress = res.data.data[0].id
            return nodeAddress
        } catch (error) {
            console.log(error.message)
        }
        return ""
    }

    let count = 0

    while(!await queryNodeAddress()){
        if(count === 10){
            console.log("unable to get chainlink node address")
            break
        }
        await sleep(delay)
        count++
        console.log("attempting to get node address...")
    }
    return await queryNodeAddress()
}

const main = async (callbackFunction=()=>{}) => {
    let _store = {}
    await sleep(5)

    _store.provider = await connectAndGetProvider()
    _store.signer = await getKnownSigner(_store.provider)
    
    _store.nodeAddress = await getNodeAddress()
    if(_store.nodeAddress === "") {
        return
    }
   
    const fundAddress = getAddressFunder(_store.provider)

    const signerBalance = await _store.signer.getBalance()
    if(Number(signerBalance) === 0) {
        await fundAddress(await _store.signer.getAddress())
        console.log(`Funded deploying account: ${await _store.signer.getAddress()} with ETH`)
    }

    // If an external test address isn't provided in the config.json file, use the default from mnemonic
    if(!config.testAddress) {
        config.testAddress = _store.signer.address
    }

    const testAddressBalance = await _store.provider.getBalance(config.testAddress)


    if(_store.signer.address !== config.testAddress && Number(testAddressBalance) === 0) {
        // fund the test address
        await fundAddress(config.testAddress)
        console.log(`Funded test address: ${config.testAddress} with ETH`)
    }
        
    const nodeAddressBalance = await _store.provider.getBalance(_store.nodeAddress)
    if(Number(nodeAddressBalance) === 0) {
        await fundAddress(_store.nodeAddress)
        console.log(`Funded node address: ${_store.nodeAddress} with ETH`)
    }

    _store.chainlinkToken = await deployChainlinkToken(_store.signer)

    await _store.chainlinkToken.transfer(_store.nodeAddress, ethers.utils.parseEther("10000"))
    await _store.chainlinkToken.transfer(config.testAddress, ethers.utils.parseEther("1000"))
    
    _store.chainlinkOracle = await setupChainlinkOracle(_store.signer, _store.chainlinkToken.address, _store.nodeAddress)

    callbackFunction(_store)
}



const callbackFunction = async (store) => {
    console.log({
        deployedBy: await store.signer.getAddress(),
        chainlinkToken: store.chainlinkToken.address,
        chainlinkOracle: store.chainlinkOracle.address,
        nodeAddress: store.nodeAddress
    })
}

main(callbackFunction)
