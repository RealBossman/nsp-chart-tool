import { ethers } from "ethers";
import UniswapV2PairABI from '../../utils/UniswapV2Pair.json';

const RPC_URL = "https://puppynet.shibrpc.com";
const FACTORY_ADDRESS = "0xb9E15055807FcDd1f845c1eBF04BF7A176379faA";
const WBONE_ADDRESS = "0x41c3F37587EBcD46C0F85eF43E38BcfE1E70Ab56";

export default async function handler(req, res) {
  const { ca } = req.query;
  if (!ca) return res.status(400).json({ error: "Missing contract address" });

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const factory = new ethers.Contract(FACTORY_ADDRESS, [
      "function getPair(address, address) external view returns (address)"
    ], provider);

    const pairAddress = await factory.getPair(ca, WBONE_ADDRESS);
    console.log("Pair address:", pairAddress);

    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      return res.status(404).json({ error: "No pair found for token" });
    }

    const pair = new ethers.Contract(pairAddress, UniswapV2PairABI, provider);
    const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");

    const logs = await provider.getLogs({
      address: pairAddress,
      fromBlock: 0,
      toBlock: "latest",
      topics: [swapTopic]
    });

    const trades = await Promise.all(logs.map(async (log) => {
      const parsed = pair.interface.parseLog(log);
      const block = await provider.getBlock(log.blockNumber);

      const { amount0In, amount1In, amount0Out, amount1Out } = parsed.args;

      const token0 = await pair.token0();
      const isToken0 = token0.toLowerCase() === ca.toLowerCase();

      const amountIn = isToken0 ? amount0In : amount1In;
      const amountOut = isToken0 ? amount0Out : amount1Out;

      const price = parseFloat(ethers.formatUnits(amountIn > 0n ? amountIn : amountOut, 18));

      return {
        timestamp: block.timestamp,
        txHash: log.transactionHash,
        price
      };
    }));

    res.status(200).json({ trades });

  } catch (err) {
    console.error("API ERROR:", err);
    res.status(500).json({ error: "Failed to fetch swap data" });
  }
}
