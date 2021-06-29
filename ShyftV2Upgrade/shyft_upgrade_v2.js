// Shyft v2 upgrade script:
//
// goal: easy to use script for upgrading tokens from v1 to v2
// assumptions:
// 1. will support either a local/arbitrary "provider" (json-rpc) **or** infura connectivity.
// 2. only cares about the primary token v1 address, and
// **uses the full registry for shyft contracts to find the upgraded contract**
// 3. will upgrade all the found tokens in the v1 account to v2
// 4. will need variable entry for the private keys to run the upgrade process, as well as
//    current gas prices.




require('dotenv').config()

const ethers = require("ethers");

// import abi
const v1ShyftKycContractArtifact = require("./build/contracts/ShyftKycContract_March26EthLaunch.json");
const v2ShyftKycContractArtifact = require("./build/contracts/ShyftKycContract.json");
const shyftKycContractRegistryArtifact = require("./build/contracts/ShyftKycContractRegistry.json");

const v1KycContractAddress = "0xcba3eae7f55d0f423af43cc85e67ab0fbf87b61c";

const assetPrivateKey = process.env.ASSET_PRIVATE_KEY;
const providerUrl = process.env.ETH_PROVIDER_URL;
const infuraAPIKey = process.env.INFURA_API_KEY;

const defaultGasPrice = process.env.DEFAULT_GAS_PRICE;

// we definitely need the private key for the funds to be upgraded
if (typeof(assetPrivateKey) == "undefined" || assetPrivateKey == null) {
    console.log("error: asset private key must be set!");
    process.exit(0);
}

// and now we'll decide whether we're using the "provider" object from the environment variables,
// or whether we'll be using the provided infura key for a more cloud-based service methodology.
let hasProvider = false;

if (typeof(providerUrl) == "undefined" || providerUrl == null || providerUrl == "") {
    console.log("\t[ using infura instead of rpc provider ]");
} else {
    console.log("\t[ using rpc provider instead of infura ]");
    hasProvider = true;
}

// and just in case no proper data has been entered for the provider, we bail here.
if (hasProvider === false && (typeof(infuraAPIKey) == "undefined" || infuraAPIKey == null)) {
    console.log("error: infura api key must be set if no rpc provider has been set!");
    process.exit(0);
}

// we'll need to have a good handle on the current gas price as well, this is defined in WEI
// online conversion utility at: https://eth-converter.com/
// and here's a website that you can find the *current* gas prices, to enter into the environment
// variable file: https://etherscan.io/gastracker

if (typeof(defaultGasPrice) == "undefined" || defaultGasPrice == null) {
    console.log("error: default gas price must be set!");
    process.exit(0);
}

// constants

const provider =
    (hasProvider === true) ?
        new ethers.providers.JsonRpcProvider(providerUrl) :
        new ethers.providers.InfuraProvider("homestead", infuraAPIKey);

const fundingWallet = new ethers.Wallet(assetPrivateKey, provider);

const v1KycInstance = new ethers.ContractFactory(v1ShyftKycContractArtifact.abi, v1ShyftKycContractArtifact.bytecode, fundingWallet);
const v2KycInstance = new ethers.ContractFactory(v2ShyftKycContractArtifact.abi, v2ShyftKycContractArtifact.bytecode, fundingWallet);
const kycRegistryInstance = new ethers.ContractFactory(shyftKycContractRegistryArtifact.abi, shyftKycContractRegistryArtifact.bytecode, fundingWallet);

// set up & connect all required block reward strata
const main = async () => {
    let allPhases = ["connect",
        "waitForSync",
        "upgradeAllTokens",
        "complete",
        "failed"];
    let phaseFunction = [null,
        waitForSync,
        upgradeAllTokens,
        null,
        null];
    let curPhase = 0;
    let updatePhase = false;

    function incrementPhase() {
        curPhase++;
        updatePhase = true;

        console.log("\t[ working on phase :: " + allPhases[curPhase] + " ]");
    }

    let v1KycContract, v2KycContract, kycRegistryContract, distributionContract;
    let kycRegistryContractAddress;

    console.log("\t[ working on phase :: " + allPhases[curPhase] + " ]");

    // connect kyc contract
    try {
        v1KycContract = await v1KycInstance.attach(v1KycContractAddress);
        kycRegistryContractAddress = await v1KycContract.callStatic.shyftKycContractRegistryAddress({gasLimit: 400000, gasPrice: defaultGasPrice});

        console.log("\t\t[ found v1KycContract :: " + v1KycContract.address + " ]");
        console.log("\t\t[ kyc registry address :: " + kycRegistryContractAddress + " ]");
    } catch (e) {
        console.log(e);
        console.log("Exiting due to above error while trying to connect the registry contract.")
        process.exit(1);
    }

    // connect registry contract
    try {
        kycRegistryContract = await kycRegistryInstance.attach(kycRegistryContractAddress);

        let v2KycContractAddress = await kycRegistryContract.callStatic.getContractAddressOfVersion(1,{gasLimit: 400000, gasPrice: defaultGasPrice});

        v2KycContract = await v2KycInstance.attach(v2KycContractAddress);
        console.log("\t\t[ found kycRegistryContract :: " + kycRegistryContract.address + " ]");
        console.log("\t\t[ found v2 shyft contract :: " + v2KycContract.address + " ]");
    } catch (e) {
        console.log(e);
        console.log("Exiting due to above error while trying to connect the registry + v2 kyc contract.")
        process.exit(1);
    }


    await waitForSync(incrementPhase);

    async function waitForSync(_onComplete) {
        _onComplete();
    }

    async function upgradeAllTokens(_onComplete) {
        // run the upgrade contract calls
        try {
            // gather the initial data
            let userV1KycContractBalance_prev = await v1KycContract.callStatic.balanceOf(fundingWallet.address, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let userV2KycContractBalance_prev = await v2KycContract.callStatic.balanceOf(fundingWallet.address, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let v2V1KycContractBalance_prev = await v1KycContract.callStatic.balanceOf(v2KycContract.address, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let v2KycContractTotalSupply_prev = await v2KycContract.callStatic.totalSupply({gasLimit: 400000, gasPrice: defaultGasPrice});
            let v2KycContractTotalUpgradeAmount_prev = await v2KycContract.callStatic.v1TotalUpgradeAmount({gasLimit: 400000, gasPrice: defaultGasPrice});

            // display to user
            console.log("\t\t[ [ prev ] user balance v1 kyc contract :: " + userV1KycContractBalance_prev + " ]");
            console.log("\t\t[ [ prev ] user balance v2 kyc contract :: " + userV2KycContractBalance_prev + " ]");
            console.log("\t\t[ [ prev ] v2 balance in v1 kyc contract :: " + v2V1KycContractBalance_prev + " ]");
            console.log("\t\t[ [ prev ] v2 kyc contract total supply :: " + v2KycContractTotalSupply_prev + " ]");
            console.log("\t\t[ [ prev ] v2 kyc contract total upgrade amount :: " + v2KycContractTotalUpgradeAmount_prev + " ]");

            // ready the upgrade event
            let transferBalance = userV1KycContractBalance_prev;
            let emptyBytes = 0x0;

            // we're using the following solidity function prototype:
            // function transferFrom(address _from, address _to, uint _tokens) public override returns (bool success) {

            // and now we perform the proper upgrade event
            let transferResult = await v1KycContract.callStatic["transfer(address,uint256,bytes)"](v2KycContract.address, transferBalance, emptyBytes, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let txSent = await v1KycContract["transfer(address,uint256,bytes)"](v2KycContract.address, transferBalance, emptyBytes, {gasLimit: 400000, gasPrice: defaultGasPrice});

            console.log("\t\t[ transferResult :: " + transferResult  + " ]");

            await txSent.wait();

            // and show the user's balance afterwards.
            let userV1KycContractBalance_after = await v1KycContract.callStatic.balanceOf(fundingWallet.address, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let userV2KycContractBalance_after = await v2KycContract.callStatic.balanceOf(fundingWallet.address, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let v2V1KycContractBalance_after = await v1KycContract.callStatic.balanceOf(v2KycContract.address, {gasLimit: 400000, gasPrice: defaultGasPrice});
            let v2KycContractTotalSupply_after = await v2KycContract.callStatic.totalSupply({gasLimit: 400000, gasPrice: defaultGasPrice});
            let v2KycContractTotalUpgradeAmount_after = await v2KycContract.callStatic.v1TotalUpgradeAmount({gasLimit: 400000, gasPrice: defaultGasPrice});

            console.log("\t\t[ [ after ] user balance v1 kyc contract :: " + userV1KycContractBalance_after + " ]");
            console.log("\t\t[ [ after ] user balance v2 kyc contract :: " + userV2KycContractBalance_after + " ]");
            console.log("\t\t[ [ after ] v2 balance in v1 kyc contract :: " + v2V1KycContractBalance_after + " ]");
            console.log("\t\t[ [ after ] v2 kyc contract total supply :: " + v2KycContractTotalSupply_after + " ]");
            console.log("\t\t[ [ after ] v2 kyc contract total upgrade amount :: " + v2KycContractTotalUpgradeAmount_after + " ]");

            _onComplete();

        } catch (e) {
            console.log(e);
            console.log("Exiting due to above error while waiting for the setByfrostNetwork of the Distribution contract to be called.");
            process.exit(1);
        }
    }


    // check every 1/10th of a second for a phase update trigger message.
    setInterval(async function() {await checkForPhaseUpdate()}, 100);

    async function checkForPhaseUpdate() {
        // see if the phase has a function associated with it.
        if (curPhase !== allPhases.indexOf("complete") && curPhase !== allPhases.indexOf("failed")) {
            if (updatePhase === true) {
                updatePhase = false;

                if (typeof(phaseFunction[curPhase]) != "undefined" && phaseFunction[curPhase] != null) {
                    await phaseFunction[curPhase](incrementPhase);
                }
            }
        } else {
            console.log("\t[ v1 -> v2 token upgrade complete ]");
            process.exit(0);
        }
    }
}

main().catch(e => `main app crashed ${e}`);