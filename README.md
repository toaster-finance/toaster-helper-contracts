# Toaster Contracts

## About

Toaster Finance is a service that helps investors and other participants in the DeFi ecosystem save money and improve their investment experience. Just as a toaster can transform your bread into the shape you want it to be, Toaster Finance can transform your assets into the shape you need them to be with a single click. By replacing complex processes with a single click, Toaster Finance significantly reduces the cost of investing for users and makes it easier for them to use DeFi services.

## Problems we want to solve

There's always a problem with investing in a DEX. There's the problem of getting the right ratio of tokens. There are also too many options. In the case of UniswapV3, you have to swap tokens with "you" to match the ratio of tokens determined by a price range set by "you". This is a very tiring process.

## Projects to address the previous issues

Toaster Contracts help solve these tiring tasks. Once you decide on a price range recommended by the toaster site, however you want to invest (e.g. only token 0, only token 1, or a random proportion of token 0 and token 1), Toaster Contracts will calculate the amount and help you invest.

### [UniswapV3 Toaster](https://github.com/toaster-finance/toaster-contracts/tree/main/projects/uniswap-v3)

---

A router that makes the Uniswap V3 an easy investment. It calculates the correct amount of token swaps for your investment and uses UniswapV3Toaster.

### [PancakeswapV3 Toaster](https://github.com/toaster-finance/toaster-contracts/tree/main/projects/pancakeswap-v3)

---

A router that makes the Pancakeswap V3 an easy investment. It calculates the correct amount of token swaps for your investment and uses PancakeswapV3Toaster.

## UniswapV3 Toaster Deployment Address

**[MAINNET]**

| CHAIN(CHAINID)   | ETHEREUM(1),POLYGON(137),BSC(56),ARBITRUM(42161),OPTIMISM(10) | BASE(8453)                                 |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------ |
| UniswapV3Toaster | 0xb8e0cdbad514edc1e8e790f4b6f5f613361802a7                    | 0x1d90546025045056c869a8cf548a38b69082e27a |
| UniswapV3Menu    | 0xa48719d977e5823a7881ba3d7a49b81673adaebb                    | 0xa48719d977e5823a7881ba3d7a49b81673adaebb |

**[TESTNET]**

| CHAIN(CHAINID)   | GOERLI(5),MUMBAI(80001),BSC_TEST(97)       |
| ---------------- | ------------------------------------------ |
| UniswapV3Toaster | 0xb8e0cdbad514edc1e8e790f4b6f5f613361802a7 |
| UniswapV3Menu    | 0xa48719d977e5823a7881ba3d7a49b81673adaebb |

## PancakeswapV3 Toaster Deployment Address

**[MAINNET]**

| CHAIN(CHAINID)       | BSC(56)                                    | BASE(8453)                                 |
| -------------------- | ------------------------------------------ | ------------------------------------------ |
| PancakeswapV3Toaster | 0x14223fb38d9cc73b5e8daff4b36fd8b1c3ff3658 | 0x6D4589Bb995e339Bc82de062eb8AF832EBEeFC2F |
| PancakeswapV3Menu    | 0x1d90546025045056c869a8cf548a38b69082e27a | 0xf7aC8A94B225B5EbD8b223d00c7bFbc96a893233 |
