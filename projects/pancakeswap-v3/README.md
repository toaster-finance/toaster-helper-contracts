# Pancakeswap V3 Toaster

## Detail of Problem

If you decide on a price range, the current price will determine the ratio of the amount of tokens 0 and 1. If the user wants to provide liquidity of $1000, it will be very cumbersome to manually invest exactly $1000, and of course they will not be able to invest the amount they want.

Even if you know the amount of tokens to swap in advance, there is a problem: the moment you swap the tokens, it will affect the current price of the pool you want to liquidate, and the previously calculated token amount will be incorrect. Therefore, you need to consider the (post-swap token amount) to determine the amount to swap.

## How we solve it?

Use the binary search method to find the amount to swap.

The amount of liquidity supplied for each price range is different, so a simple first-order calculation is not possible, so we need to find the liquidity to reach the final price to know how many tokens to swap.

1. **Find and compare the amount of token 0 and token 1 to be used by the user with the liquidity conversion amount using the formula (6.29,6.30) in the unswapv3-core whitepaper.**

2. **Find the amount to be swapped using the binary search method.**

   2-1. If L0 is greater than L1, find the swap amount of token 0 in the following way.deltaA0

   $$
   A_0 \rightarrow A_0 - \Delta A_0
   $$

   $$
   \Delta A_0 \subseteq [0 , A_0 ]
   $$

   $$
   A_1 \rightarrow A_1 + \Delta A_1
   $$

   For Swap(), we implemented it by removing all the parts of the V3Quoter method that use storage.

   $$
   \Delta A_1 = Swap(\Delta A_0)
   $$

   Search by binary search until the following equation is satisfied (maximum search depth: 72)

   $$
   \frac{A_0 - \Delta A_0}{\frac{1}{\sqrt{P_{final}}} - \frac  {1}{\sqrt{P_U}}} = \frac{A_1 + \Delta A_1}{\sqrt{P_{final}}   - \sqrt{P_L}}
   $$

   2-2. If L1 is greater than L0, find the amount of swap for token 1 in the following way.The reverse is true, so the expression is the same.

## Reference

- [UniswapV3 white paper](https://uniswap.org/whitepaper-v3.pdf)

- [SwapRouter - Pancakeswap](https://github.com/pancakeswap/pancake-v3-contracts/blob/main/projects/v3-periphery/contracts/SwapRouter.sol)
