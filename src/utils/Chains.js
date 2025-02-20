
const ETH_URL_MAINNET =
  "https://mainnet.infura.io/v3/40e2d4f67005468a83e2bcace6427bc8";
const ETH_URL_TESTNET =
  "https://kovan.infura.io/v3/40e2d4f67005468a83e2bcace6427bc8";
const MOONBEAM_TESTNET_URL =
  "https://rpc.testnet.moonbeam.network";
const BINANCE_CHAIN_TESTNET_URL =
  "https://data-seed-prebsc-1-s1.binance.org:8545";
const BINANCE_CHAIN_URL = 
  "https://bsc-dataseed1.binance.org:443";
const POLYGON_CHAIN_TESTNET_URL =
  "https://rpc-mumbai.maticvigil.com/";
const POLYGON_CHAIN_URL =
  "https://rpc-mainnet.maticvigil.com/";
const CELO_CHAIN_URL =
  "https://forno.celo.org";
const CELO_CHAIN_TESTNET_URL =
  "https://alfajores-forno.celo-testnet.org";

const networksEnum = Object.freeze({
  1: "Ethereum Main",
  2: "Morden",
  3: "Ropsten",
  4: "Rinkeby",
  56: "BSC Main",
  97: "BSC Test",
  42: "Kovan",
  137: "Polygon",
  80001: "Mumbai",
  44787: "Celo Testnet",
  42220: "Celo"
});

/**
 * Chains object
 * @constructor Chains
 */
class chains {
  constructor() {}

  checkIfNetworkIsSupported(network)  {
    if(!this.isNetworkSupported(network)) {
			throw new Error("Network has to be ETH or DOT or BSC or MATIC or CELO");
		}
  }

  isNetworkSupported(network) {
    if((network != 'ETH') && (network != 'DOT') && (network != 'BSC') && (network !='MATIC') && (network != 'CELO')){
			return false;
		}
    return true;
  }

  getRpcUrl(network, mainnet = true) {
    if(network == 'DOT') {
			return MOONBEAM_TESTNET_URL;
		} else if(network == 'BSC') {
			return (mainnet == true) ? BINANCE_CHAIN_URL : BINANCE_CHAIN_TESTNET_URL;
		} else if(network == 'ETH') {
			return (mainnet == true) ? ETH_URL_MAINNET : ETH_URL_TESTNET;
		} else if(network == 'MATIC') {
			return (mainnet == true) ? POLYGON_CHAIN_URL : POLYGON_CHAIN_TESTNET_URL;
		} else if(network == 'CELO') {
			return (mainnet == true) ? CELO_CHAIN_URL : CELO_CHAIN_TESTNET_URL;
		}
  }

  getNetworksEnum() {
    return networksEnum;
  }
}

let Chains = new chains()

export default Chains

