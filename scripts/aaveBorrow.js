const { getWeth, AMOUNT } = require("../scripts/getWeth")
const { ethers } = require("hardhat")
const { networkConfig } = require("../helper-hardhat-config")

async function main() {
  await getWeth()
  // Lending Pool Address: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c50xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  const { deployer } = await getNamedAccounts()
  const lendingPool = await getLendingPool(deployer)

  const wethTokenAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)

  console.log("Depositing...")
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
  console.log("Deposit Compelete")

  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

  const daiPrice = await getDaiPrice()
  const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
  const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"

  await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
  await getBorrowUserData(lendingPool, deployer)
  await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
  await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveErc20(daiAddress, lendingPool.address, amount, account)
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
  await repayTx.wait(1)
  console.log("Repaid")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
  const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
  await borrowTx.wait(1)
  console.log("You've Borrowed")
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616e4d11a78f511299002da57a0a94577f1f4"
  )
  const price = (await daiEthPriceFeed.latestRoundData())[1]

  console.log(`Current DAI/ETH PRICE ${price / 1e18}`)

  return price
}

async function getEthUSDPrice() {
  const getPrice = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
  )

  const ethToUsdPrice = (await getPrice.latestRoundData())[1]
  const usdEth = ethToUsdPrice.toString().slice(0, 4)
  return usdEth
}

async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account)

  const ethToUsd = await getEthUSDPrice()
  console.log(`You have $${(totalCollateralETH / 1e18) * ethToUsd} deposited`)
  console.log(`You have $${(totalDebtETH / 1e18) * ethToUsd} in debt`)
  console.log(`You have $${(availableBorrowsETH / 1e18) * ethToUsd} avaiable to borrow`)
  return { availableBorrowsETH, totalDebtETH }
}

async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  )

  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
  const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
  return lendingPool
}

async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
  const er20Token = await ethers.getContractAt("IERC20", erc20Address, account)
  const tx = await er20Token.approve(spenderAddress, amountToSpend)
  await tx.wait(1)
  console.log("Approved!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
