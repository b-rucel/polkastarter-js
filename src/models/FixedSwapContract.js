import { fixedswap } from "../interfaces";
import Contract from "./Contract";
import ERC20TokenContract from "./ERC20TokenContract";
import IDOStaking from "./IDOStaking";
import Numbers from "../utils/Numbers";
import _ from "lodash";
import moment from 'moment';
const RESIDUAL_ETH = 0.00001;
import { Decimal } from 'decimal.js';
import * as ethers from 'ethers';
import Client from "../utils/Client";

/**
 * Fixed Swap Object
 * @constructor FixedSwapContract
 * @param {Web3} web3
 * @param {Address} tokenAddress
 * @param {Address} contractAddress ? (opt)
 */
class FixedSwapContract {
	constructor({
		web3,
		tokenAddress,
		contractAddress = null /* If not deployed */,
		acc,
	}) {
		try {
			if (!web3) {
				throw new Error("Please provide a valid web3 provider");
			}
			this.web3 = web3;
			this.version = "2.0";
			if (acc) {
				this.acc = acc;
			}

			this.params = {
				web3: web3,
				contractAddress: contractAddress,
				contract: new Contract(web3, fixedswap, contractAddress),
			};

			
			if(tokenAddress){
				this.params.erc20TokenContract = new ERC20TokenContract({
					web3: web3,
					contractAddress: tokenAddress,
					acc
				});
			}else{
				if(!contractAddress){throw new Error("Please provide a contractAddress if already deployed")}
			}
			this.client = new Client();
		} catch (err) {
			throw err;
		}
	}

	__init__() {
		try {
			if (!this.getAddress()) {
				throw new Error("Please add a Contract Address");
			}
			
			this.__assert();
		} catch (err) {
			throw err;
		}
	};

	assertERC20Info = async () => {
		let tokenAddress = await this.erc20();
		this.params.erc20TokenContract = new ERC20TokenContract({
			web3: this.web3,
			contractAddress: tokenAddress,
			acc : this.acc
		});
		if(!(await this.isETHTrade())){
			this.params.tradingERC20Contract = new ERC20TokenContract({
				web3: this.web3,
				contractAddress: await this.getTradingERC20Address(),
				acc : this.acc
			});	
		};
	}

	__deploy = async (params, callback) => {
		return await this.params.contract.deploy(
			this.acc,
			this.params.contract.getABI(),
			this.params.contract.getJSON().bytecode,
			params,
			callback
		);
	};

	/**
	 * @function addToBlacklist
	 * @description Adds an address to the blacklist
	 * @param {string} address
	 */
	 addToBlacklist = async ({ address }) => {
		try {
			return await this.client.sendTx(
				this.params.web3,
				this.acc,
				this.params.contract,
				this.params.contract
					.getContract()
					.methods.addToBlacklist(address)
			);
		} catch (err) {
			throw err;
		}
	};

	/**
	 * @function removeFromBlacklist
	 * @description Removes an address from the blacklist
	 * @param {string} address
	 */
	 removeFromBlacklist = async ({ address }) => {
		try {
			return await this.client.sendTx(
				this.params.web3,
				this.acc,
				this.params.contract,
				this.params.contract
					.getContract()
					.methods.removeFromBlacklist(address)
			);
		} catch (err) {
			throw err;
		}
	};

	/**
	 * @function isBlackListed
	 * @description Returns true if the address is in the blacklist
	 * @param {string} address
	 * @returns {boolean} isBlackListed
	 */
	isBlacklisted = async ({address}) => {
		return await this.params.contract.getContract().methods.isBlacklisted(address).call();
	}

	/**
	 * @function isPaused
	 * @description Returns if the contract is paused or not
	 * @returns {boolean}
	 */

	async isPaused() {
		return await this.params.contract.getContract().methods.paused().call();
	}

	/**
	 * @function setStakingRewards
	 * @type admin
	 * @description Sets the staking rewards address
	 * @param {string} address
	 */
	async setStakingRewards({address}) {
		await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.setStakingRewards(address)
		);
		return true;
	}

	/**
	 * @function getIDOStaking
	 * @description Returns the contract for the ido staking
	 * @returns {IDOStaking}
	 */
	async getIDOStaking() {
		const contractAddr = await this.params.contract.getContract().methods.stakingRewardsAddress().call();
		if (contractAddr == '0x0000000000000000000000000000000000000000') {
			return null;
		}
		return new IDOStaking({
			acc: this.acc,
			web3: this.web3,
			contractAddress: contractAddr
		});
	}

	/**
	 * @function pauseContract
	 * @type admin
	 * @description Pause Contract
	 */
	 async pauseContract() {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.pause()
		);
	}


	/**
	 * @function erc20
	 * @description Get Token Address
	 * @returns {Address} Token Address
	 */
	async erc20() {
		return await this.params.contract
		.getContract()
		.methods.erc20()
		.call();
	}

	/**
	 * @function unpauseContract
	 * @type admin
	 * @description Unpause Contract
	 */
	async unpauseContract() {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.unpause()
		);
	}

	/* Get Functions */
	/**
	 * @function tradeValue
	 * @description Get swapratio for the pool
	 * @returns {Integer} trade value against ETH
	 */
	async tradeValue() {
		return Numbers.fromDecimals(
			(await this.params.contract
				.getContract()
				.methods.tradeValue()
				.call()),
			await this.getTradingDecimals()
		);
	}

	/**
	 * @function vestingStart
	 * @description Get Start Date of the Vesting
	 * @returns {Date}
	 */
	 async vestingStart() {
		try {
			return Numbers.fromSmartContractTimeToMinutes(
				await this.params.contract.getContract().methods.vestingStart().call()
			);
		} catch (e) {
			// Swap v2
			return await this.endDate();
		}
	}

	/**
	 * @function startDate
	 * @description Get Start Date of Pool
	 * @returns {Date}
	 */
	async startDate() {
		return Numbers.fromSmartContractTimeToMinutes(
			await this.params.contract.getContract().methods.startDate().call()
		);
	}

	/**
	 * @function endDate
	 * @description Get End Date of Pool
	 * @returns {Date}
	 */
	async endDate() {
		return Numbers.fromSmartContractTimeToMinutes(
			await this.params.contract.getContract().methods.endDate().call()
		);
	}

	/**
	 * @function isFinalized
	 * @description To see if contract was finalized
	 * @returns {Boolean}
	 */
	async isFinalized() {
		return await this.params.contract.getContract().methods.hasFinalized().call()
		
	}

	/**
	 * @function individualMinimumAmount
	 * @description Get Individual Minimum Amount for each address
	 * @returns {Integer}
	 */
	async individualMinimumAmount() {
		return Numbers.fromDecimals(
			await this.params.contract
				.getContract()
				.methods.individualMinimumAmount()
				.call(),
			await this.getDecimals()
		);
	}

	/**
	 * @function individualMaximumAmount
	 * @description Get Individual Maximum Amount for each address
	 * @returns {Integer}
	 */
	async individualMaximumAmount() {
		return Numbers.fromDecimals(
			(await this.params.contract
				.getContract()
				.methods.individualMaximumAmount()
				.call()),
			await this.getDecimals()
		);
	}

	/**
	 * @function minimumRaise
	 * @description Get Minimum Raise amount for Token Sale
	 * @returns {Integer} Amount in Tokens
	 */
	async minimumRaise() {
		return Numbers.fromDecimals(
			(await this.params.contract
				.getContract()
				.methods.minimumRaise()
				.call()),
			await this.getDecimals()
		);
	}

	/**
	 * @function tokensAllocated
	 * @description Get Total tokens Allocated already, therefore the tokens bought until now
	 * @returns {Integer} Amount in Tokens
	 */
	async tokensAllocated() {
		return Numbers.fromDecimals(
			(await this.params.contract
				.getContract()
				.methods.tokensAllocated()
				.call()),
			await this.getDecimals()
		);
	}

	/**
	 * @function tokensForSale
	 * @description Get Total tokens Allocated/In Sale for the Pool
	 * @returns {Integer} Amount in Tokens
	 */
	async tokensForSale() {
		return Numbers.fromDecimals(
			await this.params.contract
				.getContract()
				.methods.tokensForSale()
				.call(),
			await this.getDecimals()
		);
	}

	/**
	 * @function hasMinimumRaise
	 * @description See if hasMinimumRaise 
	 * @returns {Boolea} 
	 */
	async hasMinimumRaise() {
		return await this.params.contract
			.getContract()
			.methods.hasMinimumRaise()
			.call();
	}

	/**
	 * @function minimumReached
	 * @description See if minimumRaise was Reached
	 * @returns {Integer}
	 */
	async wasMinimumRaiseReached() {
		let hasMinimumRaise = await this.hasMinimumRaise();
		if(hasMinimumRaise){
			let tokensAllocated = await this.tokensAllocated();
			let minimumRaise = await this.minimumRaise();
			return parseFloat(tokensAllocated) > parseFloat(minimumRaise);
		}else{
			return true;
		}
	}

	/**
	 * @function tokensAvailable
	 * @description Get Total tokens owned by the Pool
	 * @returns {Integer} Amount in Tokens
	 */
	async tokensAvailable() {
		return Numbers.fromDecimals(
			await this.params.contract
				.getContract()
				.methods.availableTokens()
				.call(),
			await this.getDecimals()
		);
	}

	/**
	 * @function tokensLeft
	 * @description Get Total tokens available to be sold in the pool
	 * @returns {Integer} Amount in Tokens
	 */
	async tokensLeft() {
		return Numbers.fromDecimals(
			await this.params.contract
				.getContract()
				.methods.tokensLeft()
				.call(),
			await this.getDecimals()
		);
	}

	/**
	 * @function setSignerPublicAddress
	 * @description Set the public address of the signer
	 * @param {string} address
	 */
	 setSignerPublicAddress = async ({ address }) => {
		try {
			return await this.client.sendTx(
				this.params.web3,
				this.acc,
				this.params.contract,
				this.params.contract
					.getContract()
					.methods.setSignerPublicAddress(address)
			);
		} catch (err) {
			throw err;
		}
	};

	/**
	 * @function signerPublicAddress
	 * @description Get the public address of the signer
	 * @returns {string} address
	 */

	async signerPublicAddress() {
		return await this.params.contract.getContract().methods.signerPublicAddress().call();
	}

	/**
	 * @function withdrawableUnsoldTokens
	 * @description Get Total tokens available to be withdrawn by the admin
	 * @returns {Integer} Amount in Tokens
	 */
	async withdrawableUnsoldTokens() {
		var res = 0;
		if(await this.hasFinalized()
		&& !(await this.wereUnsoldTokensReedemed())
		){
			if(await this.wasMinimumRaiseReached()){
				/* Minimum reached */
				res = (await this.tokensForSale()) - (await this.tokensAllocated());
			}else{
				/* Minimum reached */
				res = await this.tokensForSale();
			}
		}
		return res;
	}

	/**
	 * @function withdrawableFunds
	 * @description Get Total funds raised to be withdrawn by the admin
	 * @returns {Integer} Amount in ETH
	 */
	async withdrawableFunds() {
		var res = 0;
		var hasFinalized = await this.hasFinalized();
		var wasMinimumRaiseReached = await this.wasMinimumRaiseReached();
		if(hasFinalized && wasMinimumRaiseReached){
			res = await this.getBalance();
		}
		return res;
	}

	/**
	 * @function isTokenSwapAtomic
	 * @description Verify if the Token Swap is atomic on this pool
	 * @returns {Boolean}
	 */
	async isTokenSwapAtomic() {
		return await this.params.contract
			.getContract()
			.methods.isTokenSwapAtomic()
			.call();
	}


	/**
	 * @function hasWhitelisting
	 * @description Verify if swap has whitelisting
	 * @returns {Boolean}
	 */
	async hasWhitelisting() {
		return await this.params.contract
			.getContract()
			.methods.hasWhitelisting()
			.call();
	}

	/**
	 * @function isWhitelisted
	 * @description Verify if address is whitelisted
	 * @param {string} address
	 * @returns {Boolean}
	 */
	async isWhitelisted({address}) {
		let res = await this.params.contract
			.getContract()
			.methods.isWhitelisted(address)
			.call();
		return res == true ? true : false;
	}
	
	/**
	 * @function wereUnsoldTokensReedemed
	 * @description Verify if the admin already reemeded unsold tokens
	 * @returns {Boolean}
	 */
	async wereUnsoldTokensReedemed() {
		try {
			return await this.params.contract
				.getContract()
				.methods.unsoldTokensRedeemed()
				.call();
		} catch (e) {
			console.error(e);
		}
		return await this.params.contract
			.getContract()
			.methods.unsoldTokensReedemed()
			.call();
	}

	/**
	 * @function isFunded
	 * @description Verify if the Token Sale is Funded with all Tokens proposed in tokensForSale
	 * @returns {Boolean}
	 */
	async isFunded() {
		return await this.params.contract
			.getContract()
			.methods.isSaleFunded()
			.call();
	}

	/**
	 * @function isOpen
	 * @description Verify if the Token Sale is Open for Swap
	 * @returns {Boolean}
	 */
	async isOpen() {
		return await this.params.contract.getContract().methods.isOpen().call();
	}

	/**
	 * @function hasStarted
	 * @description Verify if the Token Sale has started the Swap
	 * @returns {Boolean}
	 */
	async hasStarted() {
		return await this.params.contract
			.getContract()
			.methods.hasStarted()
			.call();
	}

	/**
	 * @function hasFinalized
	 * @description Verify if the Token Sale has finalized, if the current date is after endDate
	 * @returns {Boolean}
	 */
	async hasFinalized() {
		return await this.params.contract
			.getContract()
			.methods.hasFinalized()
			.call();
	}

	/**
	 * @function isETHTrade
	 * @description Verify if Token Sale is against Ethereum
	 * @returns {Boolean}
	 */
	async isETHTrade() {
		return await this.params.contract
			.getContract()
			.methods.isETHTrade()
			.call();		
	}

	/**
	 * @function isPOLSWhitelisted
	 * @description Verify if Token Sale is POLS Whitelisted
	 * @returns {Boolean}
	 */
	async isPOLSWhitelisted() {
		return await this.params.contract
		.getContract()
		.methods.isPOLSWhitelisted()
		.call();
	}

	/**
	 * @function isAddressPOLSWhitelisted
	 * @description Verify if Address is Whitelisted by POLS (returns false if not needed)
	 * @returns {Boolean}
	 */
	async isAddressPOLSWhitelisted(){
		return await this.params.contract
		.getContract()
		.methods.isAddressPOLSWhitelisted()
		.call();
	}

	/**
	 * @function getTradingDecimals
	 * @description Get Trading Decimals (18 if isETHTrade, X if not)
	 * @returns {Integer}
	 */
	async getTradingDecimals(){
		const tradeAddress = await this.getTradingERC20Address();
		if (tradeAddress == '0x0000000000000000000000000000000000000000') {
			return 18;
		}
		const contract = new ERC20TokenContract({
			web3: this.web3,
			contractAddress: tradeAddress,
			acc : this.acc
		});
		return await contract.getDecimals();
	}

	/**
	 * @function getTradingERC20Address
	 * @description Get Trading Address if ERC20
	 * @returns {Address}
	 */
	async getTradingERC20Address(){
		try {
			return await this.params.contract
			.getContract()
			.methods.erc20TradeIn()
			.call();
		} catch (e) {
			// Swap v2
			return '0x0000000000000000000000000000000000000000';
		}
	}

	/**
	 * @function isPreStart
	 * @description Verify if the Token Sale in not open yet, where the admin can fund the pool
	 * @returns {Boolean}
	 */
	async isPreStart() {
		return await this.params.contract
			.getContract()
			.methods.isPreStart()
			.call();
	}

	/**
	 * @function getCurrentSchedule
	 * @description Gets Current Schedule
	 * @returns {Integer}
	 */
	async getCurrentSchedule() {
		return parseInt(await this.params.contract
			.getContract()
			.methods.getCurrentSchedule()
			.call());
	}

	/**
	 * @function getVestingSchedule
	 * @description Gets Vesting Schedule
	 * @param {Integer} Position Get Position of Integer 
	 * @returns {Array | Integer}
	 */
	async getVestingSchedule({position}) {
		return parseInt(await this.params.contract
			.getContract()
			.methods.vestingSchedule(position)
			.call());
	}

	/**
	 * @function getPurchase
	 * @description Get Purchase based on ID
	 * @param {Integer} purchase_id
	 * @returns {Integer} _id
	 * @returns {Integer} amount
	 * @returns {Address} purchaser
	 * @returns {Integer} costAmount
	 * @returns {Date} timestamp
	 * @returns {Integer} amountReedemed
	 * @returns {Boolean} wasFinalized
	 * @returns {Boolean} reverted
	 */

	getPurchase = async ({ purchase_id }) => {
		let res = await this.params.contract
			.getContract()
			.methods.getPurchase(purchase_id)
			.call();
		let amount = Numbers.fromDecimals(res.amount, await this.getDecimals());
		let costAmount = Numbers.fromDecimals(res.costAmount, await this.getTradingDecimals());
		let amountReedemed = Numbers.fromDecimals(res.amountRedeemed, await this.getDecimals());
		let amountLeftToRedeem = amount-amountReedemed;

		let isFinalized = await this.hasFinalized();
		let amountToReedemNow = 0;
		try {
			amountToReedemNow = isFinalized ? Numbers.fromDecimals((await this.params.contract
				.getContract()
				.methods.getRedeemableTokensAmount(purchase_id).call()).amount, await this.getDecimals()) : 0
		} catch (e) {
			// Swap v2
			const abi = JSON.parse('[{ "inputs": [ { "internalType": "uint256", "name": "purchase_id", "type": "uint256" } ], "name": "getPurchase", "outputs": [ { "name": "", "type": "uint256" }, { "name": "", "type": "address" }, { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }, { "name": "", "type": "bool" }, { "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }]');
			const contract = new Contract(this.web3, {abi}, this.params.contractAddress);
			res = await contract
				.getContract()
				.methods.getPurchase(purchase_id)
				.call();

			lastTrancheSent = parseInt(res[5]);
			amount = Numbers.fromDecimals(res[0], await this.getDecimals());
			costAmount = Numbers.fromDecimals(res[2], await this.getTradingDecimals());
			amountReedemed = Numbers.fromDecimals(res[4], await this.getDecimals());
			amountLeftToRedeem = amount-amountReedemed;

			let currentSchedule = await this.getCurrentSchedule();
			let lastTrancheSent = parseInt(res[5]);
			for(var i = lastTrancheSent+1; i <= currentSchedule; i++){
				amountToReedemNow = amountToReedemNow + amount*(await this.getVestingSchedule({position: i}))/10000
			}
			return {
				_id: purchase_id,
				amount: amount,
				purchaser: res[1],
				costAmount: costAmount,
				timestamp: Numbers.fromSmartContractTimeToMinutes(res[3]),
				amountReedemed : amountReedemed,
				amountLeftToRedeem : amountLeftToRedeem,
				amountToReedemNow : isFinalized ? amountToReedemNow : 0,
				lastTrancheSent :  lastTrancheSent,
				wasFinalized: res[6],
				reverted: res[7],
			};
		}

		// ToDo add a test for amountToReedemNow
		return {
			_id: purchase_id,
			amount: amount,
			purchaser: res.purchaser,
			costAmount: costAmount,
			timestamp: Numbers.fromSmartContractTimeToMinutes(res.timestamp),
			amountReedemed : amountReedemed,
			amountLeftToRedeem : amountLeftToRedeem,
			amountToReedemNow,
			wasFinalized: res.wasFinalized,
			reverted: res.reverted,
		};
	};

	/**
	 * @function getWhiteListedAddresses
	 * @description Get Whitelisted Addresses
	 * @returns {Array | Address} addresses
	 */

	getWhitelistedAddresses = async () =>
		await this.params.contract.getContract().methods.getWhitelistedAddresses().call();

	/**
	 * @function getBuyers
	 * @description Get Buyers
	 * @returns {Array | Integer} _ids
	 */

	getBuyers = async () =>
		await this.params.contract.getContract().methods.getBuyers().call();

	/**
	 * @function getPurchaseIds
	 * @description Get All Purchase Ids
	 * @returns {(Array | Integer)} _ids
	 */
	getPurchaseIds = async () => {
		try {
			let res = await this.params.contract
				.getContract()
				.methods.getPurchasesCount()
				.call();
			let ids = [];
			for (let i = 0; i < res; i++) {
				ids.push(i);
			}
			return ids;
		} catch(e) {
			// Swap v2
			// ToDo Refactor
			const abi = JSON.parse('[{ "constant": true, "inputs": [], "name": "getPurchaseIds", "outputs": [ { "name": "", "type": "uint256[]" } ], "payable": false, "stateMutability": "view", "type": "function" }]');
			const contract = new Contract(this.web3, {abi}, this.params.contractAddress);
			let res = await contract
				.getContract()
				.methods.getPurchaseIds()
				.call();
			return res.map((id) => Numbers.fromHex(id))
		}
	};

	/**
	 * @function getPurchaseIds
	 * @description Get All Purchase Ids filter by Address/Purchaser
	 * @param {Address} address
	 * @returns {Array | Integer} _ids
	 */
	getAddressPurchaseIds = async ({ address }) => {
		let res = await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.getMyPurchases(address),
			true
		);
		return res.map((id) => Numbers.fromHex(id));
	};

	/**
	 * @function getCostFromTokens
	 * @description Get Cost from Tokens Amount
	 * @param {Integer} tokenAmount
	 * @returns {Integer} costAmount
	 */
	getCostFromTokens = async ({ tokenAmount }) => {
		let amountWithDecimals = Numbers.toSmartContractDecimals(
			tokenAmount,
			await this.getDecimals()
		);

		return Numbers.fromDecimals(
			await this.params.contract
				.getContract()
				.methods.cost(amountWithDecimals)
				.call(),
			await this.getTradingDecimals()
		);
	};

	/**
	 * @function getDistributionInformation
	 * @description Get Distribution Information
	 * @returns {Integer} currentSchedule (Ex : 1)
	 * @returns {Integer} vestingTime (Ex : 1)
	 * @returns {Array | Integer} vestingSchedule (Ex : [100])
	 * @returns {Date} vestingStart
	 */
	getDistributionInformation = async () => {
		
		let currentSchedule = 0;
		if(await this.hasStarted()){
			currentSchedule = parseInt(await this.getCurrentSchedule());
		}
		let vestingTime = parseInt(await this.params.contract.getContract().methods.vestingTime().call());
		let legacy = false;
		try {
			await this.getSmartContractVersion();
		} catch (e) {
			legacy = true;
		}

		let vestingSchedule = [];

		if (legacy) {
			for(var i = 1; i <= vestingTime; i++){
				let a = parseInt(await this.getVestingSchedule({position: i}));
				vestingSchedule.push(a);
			}
		} else {
			for(var i = 1; i < vestingTime; i++){
				let a = parseInt(await this.getVestingSchedule({position: i - 1}));
				vestingSchedule.push(a);
			}
		}

		const vestingStart = await this.vestingStart();
		

		return {
			currentSchedule,
			vestingTime,
			vestingSchedule,
			vestingStart
		}
	}

	

	/* Legacy Call */
	getETHCostFromTokens = () => {throw new Error("Please use 'getCostFromTokens' instead")};

	/* POST User Functions */

	/**
	 * @function swap
	 * @description Swap tokens by Ethereum or ERC20
	 * @param {Integer} tokenAmount
	 * @param {string=} signature Signature for the offchain whitelist
	 */

	swap = async ({ tokenAmount, callback, signature }) => {
		let amountWithDecimals = Numbers.toSmartContractDecimals(
			tokenAmount,
			await this.getDecimals()
		);

		let cost = await this.getCostFromTokens({
			tokenAmount,
		});

		let costToDecimals = Numbers.toSmartContractDecimals(cost, await this.getTradingDecimals());

		if (!signature) {
			signature = '0x00';
		}

		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.swap(amountWithDecimals, signature),
			false,
			await this.isETHTrade() ? costToDecimals : 0,
			callback
		);
	};

	__oldSwap = async ({ tokenAmount, callback }) => {
		console.log("swap (tokens Amount)", tokenAmount);
		let amountWithDecimals = Numbers.toSmartContractDecimals(
			tokenAmount,
			await this.getDecimals()
		);

		let cost = await this.getCostFromTokens({
			tokenAmount,
		});
		console.log("cost in ETH (after getCostFromTokens) ", cost);

		let costToDecimals = Numbers.toSmartContractDecimals(cost, await this.getTradingDecimals());

		console.log("swap (amount in decimals) ", amountWithDecimals);
		console.log("cost (amount in decimals) ", costToDecimals);

		const abi = JSON.parse('[{ "constant": false, "inputs": [ { "name": "_amount", "type": "uint256" } ], "name": "swap", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }]');
		const contract = new Contract(this.web3, {abi}, this.params.contractAddress);

		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			contract,
			contract.getContract().methods.swap(amountWithDecimals),
			false,
			await this.isETHTrade() ? costToDecimals : 0,
			callback
		);
	};

	/**
	 * @function redeemTokens
	 * @variation isStandard
	 * @description Reedem tokens bought
	 * @param {Integer} purchase_id
	 * @param {Boolean=} stake If true send token to the ido staking contract
	 */
	redeemTokens = async ({ purchase_id, stake = false }) => {
		let legacy = false;
		try {
			await this.getSmartContractVersion();
		} catch (e) {
			legacy = true;
		}
		if (legacy) {
			// Swap v2
			const abi = JSON.parse('[{ "constant": false, "inputs": [ { "name": "purchase_id", "type": "uint256" } ], "name": "redeemTokens", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }]');
			const contract = new Contract(this.web3, {abi}, this.params.contractAddress);
			return await this.client.sendTx(
				this.params.web3,
				this.acc,
				contract,
				contract.getContract().methods.redeemTokens(purchase_id)
			);
		}
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.transferTokens(purchase_id, stake)
		);
	};

	/**
	 * @function redeemGivenMinimumGoalNotAchieved
	 * @variation isStandard
	 * @description Reedem Ethereum from sale that did not achieve minimum goal
	 * @param {Integer} purchase_id
	 */
	redeemGivenMinimumGoalNotAchieved = async ({ purchase_id }) => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract
				.getContract()
				.methods.redeemGivenMinimumGoalNotAchieved(purchase_id)
		);
	};

	/**
	 * @function withdrawUnsoldTokens
	 * @description Withdraw unsold tokens of sale
	 */

	withdrawUnsoldTokens = async () => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.withdrawUnsoldTokens()
		);
	};

	/**
	 * @function withdrawFunds
	 * @description Withdraw all funds from tokens sold
	 */
	withdrawFunds = async () => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.withdrawFunds()
		);
	};

	/**
	 * @function approveFundERC20
	 * @param {Integer} tokenAmount
	 * @description Approve the pool to use approved tokens for sale
	 */
	approveFundERC20 = async ({ tokenAmount, callback }) => {
		return await this.getTokenContract().approve({
			address: this.getAddress(),
			amount: tokenAmount,
			callback
		});
	};

	/**
	 * @function setIndividualMaximumAmount
	 * @type admin
	 * @param {Integer} individualMaximumAmount
	 * @description Modifies the max allocation
	 */
	 setIndividualMaximumAmount = async ( { individualMaximumAmount } ) => {
		const maxAmount = Numbers.toSmartContractDecimals(
			individualMaximumAmount,
			await this.getDecimals()
		);
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.setIndividualMaximumAmount(maxAmount)
		);
	};

	/**
	 * @function setEndDate
	 * @type admin
	 * @param {Date} endDate
	 * @description Modifies the end date for the pool
	 */
	 setEndDate = async ( { endDate } ) => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.setEndDate(Numbers.timeToSmartContractTime(endDate))
		);
	};

	/**
	 * @function setStartDate
	 * @type admin
	 * @param {Date} startDate
	 * @description Modifies the start date for the pool
	 */
	 setStartDate = async ( { startDate } ) => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.setStartDate(Numbers.timeToSmartContractTime(startDate))
		);
	}

	/**
	 * @function setHasWhitelisting
	 * @type admin
	 * @param {boolean} hasWhitelist
	 * @description Modifies if the pool has whitelisting or not
	 */
	setHasWhitelisting = async ( { hasWhitelist } ) => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.setHasWhitelisting(hasWhitelist)
		);
	}

	/**
	 * @function setVesting
	 * @type admin
	 * @param {Array<Integer>=} vestingSchedule Vesting schedule in %
	 * @param {String=} vestingStart Vesting start date (Default: endDate)
	 * @param {Number=} vestingCliff Seconds between every vesting schedule (Default: 0)
	 * @param {Number=} vestingDuration Vesting duration (Default: 0)
	 * @description Modifies the current vesting config
	 */
	 setVesting = async ( { 
		vestingSchedule=[],
		vestingStart,
		vestingCliff = 0,
		vestingDuration = 0 
	} ) => {

		if(vestingSchedule.length > 0 && vestingSchedule.reduce((a, b) => a + b, 0) != 100){
			throw new Error("'vestingSchedule' sum has to be equal to 100")
		}
		
		const DECIMALS_PERCENT_MUL = 10**12;
		vestingSchedule = vestingSchedule.map( a => String(new Decimal(a).mul(DECIMALS_PERCENT_MUL)).toString());

		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.setVesting(
				Numbers.timeToSmartContractTime(vestingStart), vestingCliff, vestingDuration, vestingSchedule
			)
		);
	}

	/**
	 * @function approveSwapERC20
	 * @param {Integer} tokenAmount
	 * @description Approve the investor to use approved tokens for the sale
	 */
	approveSwapERC20 = async ({ tokenAmount, callback }) => {
		if(await this.isETHTrade()){throw new Error("Funcion only available to ERC20 Trades")};
		return await this.params.tradingERC20Contract.approve({
			address: this.getAddress(),
			amount: tokenAmount,
			callback
		});
	};

	/**
	 * @function isApprovedSwapERC20
	 * @param {Integer} tokenAmount
	 * @param {Address} address
	 * @description Verify if it is approved to invest
	 */
	isApprovedSwapERC20 = async ({ tokenAmount, address, callback }) => {
		if(await this.isETHTrade()){throw new Error("Funcion only available to ERC20 Trades")};
		return await this.params.tradingERC20Contract.isApproved({
			address,
			spenderAddress: this.getAddress(),
			amount: tokenAmount,
			callback
		});
	};

	/**
	 * @function isApproved
	 * @description Verify if the Admin has approved the pool to use receive the tokens for sale
	 * @param {Integer} tokenAmount
	 * @param {Address} address
	 * @returns {Boolean}
	 */
	isApproved = async ({ tokenAmount, address }) => {
		return await this.getTokenContract().isApproved({
			address: address,
			amount: tokenAmount,
			spenderAddress: this.getAddress()
		});
	};

	/**
	 * @function fund
	 * @description Send tokens to pool for sale, fund the sale
	 * @param {Integer} tokenAmount
	 */
	fund = async ({ tokenAmount, callback }) => {
		let amountWithDecimals = Numbers.toSmartContractDecimals(
			tokenAmount,
			await this.getDecimals()
		);

		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.fund(amountWithDecimals),
			null,
			null,
			callback
		);
	};

	/**
	 * @function addWhitelistedAddress
	 * @description add WhiteListed Address
	 * @param { Array | Addresses} Addresses
	 */
	addWhitelistedAddress = async ({addresses}) => {
		
		if(!addresses || !addresses.length || addresses.length == 0){
			throw new Error("Addresses not well setup");
		}

		let oldAddresses = await this.getWhitelistedAddresses();
		addresses = addresses.map( a => String(a).toLowerCase())
		oldAddresses = oldAddresses.map( a => String(a).toLowerCase());
		var addressesClean = [];
		
		addresses = addresses.filter( (item) => {
			if(
				(oldAddresses.indexOf(item) < 0) && 
				(addressesClean.indexOf(item) < 0)
				){
				// Does not exist
				addressesClean.push(item);
			}
		})

		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.add(addressesClean)
		);
	};

	/**
	 * @function removeWhitelistedAddress
	 * @param { Array | Addresses} addresses
	 * @param {Integer} index
	 * @description remove WhiteListed Address
	 */
	removeWhitelistedAddress = async ({address, index}) => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.remove(address, index)
		);
	};


	/**
	 * @function safePull
	 * @description Safe Pull all tokens & ETH
	 */
	safePull = async () => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract.getContract().methods.safePull(),
			null,
			0
		);
	};

	/**
	 * @function removeOtherERC20Tokens
	 * @description Remove Tokens from other ERC20 Address (in case of accident)
	 * @param {Address} tokenAddress
	 * @param {Address} toAddress
	 */
	removeOtherERC20Tokens = async ({ tokenAddress, toAddress }) => {
		return await this.client.sendTx(
			this.params.web3,
			this.acc,
			this.params.contract,
			this.params.contract
				.getContract()
				.methods.removeOtherERC20Tokens(tokenAddress, toAddress)
		);
	};

	__assert() {
		this.params.contract.use(fixedswap, this.getAddress());
	}

	getDecimals = async () => {
		return await this.getTokenContract().getDecimals();
	}

	/**
	* @function deploy
	* @description Deploy the Pool Contract
	* @param {Float} tradeValue Buy price
	* @param {Float} tokensForSale Tokens for sale
	* @param {String} endDate End date
	* @param {String} startDate Start date
	* @param {String=} ERC20TradingAddress Token to use in the swap (Default: 0x0000000000000000000000000000000000000000)
	* @param {Float=} individualMinimumAmount Min cap per wallet. 0 to disable it. (Default: 0)
	* @param {Float=} individualMaximumAmount Max cap per wallet. 0 to disable it. (Default: 0)
	* @param {Boolean=} isTokenSwapAtomic Receive tokens right after the swap. (Default: false)
	* @param {Float=} minimumRaise Soft cap (Default: 0)
	* @param {Float=} feeAmount Fee amount (Default: 1)
	* @param {Number=} tradingDecimals To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18) (Default: 0)
	* @param {Boolean=} hasWhitelisting Has White Listing. (Default: false)
	* @param {Boolean=} isPOLSWhitelist Has White Listing. (Default: false)
	* @param {Array<Integer>=} vestingSchedule Vesting schedule in %
	* @param {String=} vestingStart Vesting start date (Default: endDate)
	* @param {Number=} vestingCliff Seconds to wait for the first unlock after the vesting start (Default: 0)
	* @param {Number=} vestingDuration Seconds to wait between every unlock (Default: 0)
	*/
	deploy = async ({
		tradeValue,
		tokensForSale,
		startDate,
		endDate,
		individualMinimumAmount = 0,
		individualMaximumAmount = 0,
		isTokenSwapAtomic = false,
		minimumRaise = 0,
		feeAmount = 1,
		hasWhitelisting = false,
		callback,
		ERC20TradingAddress = '0x0000000000000000000000000000000000000000',
		isPOLSWhitelist = false,
		tradingDecimals = 0, /* To be the decimals of the currency in case (ex : USDT -> 9; ETH -> 18) */
		vestingSchedule=[],
		vestingStart,
		vestingCliff = 0,
		vestingDuration = 0
	}) => {
		if (_.isEmpty(this.getTokenAddress())) {
			throw new Error("Token Address not provided");
		}
		if (tradeValue <= 0) {
			throw new Error("Trade Value has to be > 0");
		}
		if (tokensForSale <= 0) {
			throw new Error("Tokens for Sale has to be > 0");
		}
		if (feeAmount < 1) {
			throw new Error("Fee Amount has to be >= 1");
		}
		if(minimumRaise != 0 && (minimumRaise > tokensForSale)) {
			throw new Error("Minimum Raise has to be smaller than total Raise")
		}
		if(Date.parse(startDate) >= Date.parse(endDate)) {
			throw new Error("Start Date has to be smaller than End Date")
		}
		if(Date.parse(startDate) <= Date.parse(moment(Date.now()).add(2, 'm').toDate())) {
			throw new Error("Start Date has to be higher (at least 2 minutes) than now")
		}
		if(individualMaximumAmount < 0) {
			throw new Error("Individual Maximum Amount should be bigger than 0")
		}
		if(individualMinimumAmount < 0) {
			throw new Error("Individual Minimum Amount should be bigger than 0")
		}

		if(individualMaximumAmount > 0){
			/* If exists individualMaximumAmount */
			if(individualMaximumAmount <= individualMinimumAmount) {
				throw new Error("Individual Maximum Amount should be bigger than Individual Minimum Amount")
			}
			if(individualMaximumAmount > tokensForSale) {
				throw new Error("Individual Maximum Amount should be smaller than total Tokens For Sale")
			}
		}

		if(ERC20TradingAddress != '0x0000000000000000000000000000000000000000' && (tradingDecimals == 0)){
			throw new Error("If an ERC20 Trading Address please add the 'tradingDecimals' field to the trading address (Ex : USDT -> 6)");
		}else{
			/* is ETH Trade */
			tradingDecimals = 18;
		}
	
		if(individualMaximumAmount == 0){
			individualMaximumAmount = tokensForSale; /* Set Max Amount to Unlimited if 0 */
		}
		
		if(vestingSchedule.length > 0 && vestingSchedule.reduce((a, b) => a + b, 0) != 100){
			throw new Error("'vestingSchedule' sum has to be equal to 100")
		}
		
		const DECIMALS_PERCENT_MUL = 10**12;
		vestingSchedule = vestingSchedule.map( a => String(new Decimal(a).mul(DECIMALS_PERCENT_MUL)).toString());

		const FLAG_isTokenSwapAtomic = 1; // Bit 0
		const FLAG_hasWhitelisting = 2; // Bit 1
		const FLAG_isPOLSWhitelisted = 4; // Bit 2 - true => user must have a certain amount of POLS staked to participate

		if (vestingSchedule.length == 0) {
			vestingCliff = 0;
		}
		if (!vestingStart) {
			vestingStart = endDate;
		}
		let params = [
			this.getTokenAddress(),
			Numbers.toSmartContractDecimals(tradeValue, tradingDecimals),
			Numbers.toSmartContractDecimals(tokensForSale, await this.getDecimals()),
			Numbers.timeToSmartContractTime(startDate),
			Numbers.timeToSmartContractTime(endDate),
			Numbers.toSmartContractDecimals(
				individualMinimumAmount,
				await this.getDecimals()
			),
			Numbers.toSmartContractDecimals(
				individualMaximumAmount,
				await this.getDecimals()
			),
			true, // ignored
			Numbers.toSmartContractDecimals(minimumRaise, await this.getDecimals()),
			parseInt(feeAmount),
			(isTokenSwapAtomic ? FLAG_isTokenSwapAtomic : 0) | (hasWhitelisting ? FLAG_hasWhitelisting : 0) | (isPOLSWhitelist ? FLAG_isPOLSWhitelisted : 0), // Flags
			ERC20TradingAddress,
			Numbers.timeToSmartContractTime(vestingStart),
			vestingCliff,
			vestingDuration,
			vestingSchedule,
			
		];
		let res = await this.__deploy(params, callback);
		this.params.contractAddress = res.contractAddress;
		/* Call to Backend API */

		this.__assert();
		return res;
	};

	getAddress() {
		return this.params.contractAddress;
	}

	getTokenAddress() {
		return this.getTokenContract().getAddress();
	}

	getTokenContract() {
		return this.params.erc20TokenContract;
	}

	/**
	 * @function getSmartContractVersion
	 * @description Returns the version of the smart contract that is currently inside psjs
	 * @param {Address} Address
	 */
	getSmartContractVersion = async () => {
		return await this.params.contract.getContract().methods.getAPIVersion().call();
	}

	/**
	 * @function getBalance
	 * @description Get Balance of Contract
	 * @param {Integer} Balance
	 */
	getBalance = async () => {
		if(await this.isETHTrade()){
			let wei = await this.web3.eth.getBalance(this.getAddress());
			return this.web3.utils.fromWei(wei, 'ether');
		}else{
			return await this.getTokenContract().getTokenAmount(this.getAddress());
		}
	
	};
}

export default FixedSwapContract;
