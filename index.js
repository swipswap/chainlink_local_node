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
    contract.deployTransaction.wait()
    return contract
}

const setupChainlinkOracle = async (signer, linkToken, nodeAddress) => {
    const factory = new ethers.ContractFactory(oracleABI, oracleBytecode, signer)
    const contract = await factory.deploy(linkToken)
    contract.deployTransaction.wait()
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
    const provider = await connectAndGetProvider()
    const knownSigner = await getKnownSigner(provider)
    const fundAddress = getAddressFunder(provider)
    await fundAddress(knownSigner.getAddress())
    await fundAddress(config.testAddress)

    const chainlinkToken = await deployChainlinkToken(knownSigner)

    const nodeAddress = await getNodeAddress()
    if(nodeAddress === ""){
        return
    }
    await fundAddress(nodeAddress)

    await chainlinkToken.transfer(nodeAddress, ethers.utils.parseEther("10000"))
    await chainlinkToken.transfer(config.testAddress, ethers.utils.parseEther("1000"))
    
    const chainlinOracle = await setupChainlinkOracle(knownSigner, chainlinkToken.address, nodeAddress)

    _store = {..._store, chainlinkToken, provider, knownSigner, chainlinOracle, nodeAddress}

    callbackFunction(_store)
}



const callbackFunction = (store) => {
    console.log({
        chainlinkToken: store.chainlinkToken.address,
        chainlinOracle: store.chainlinOracle.address,
        nodeAddress:    store.nodeAddress
    })
}

main(callbackFunction)
