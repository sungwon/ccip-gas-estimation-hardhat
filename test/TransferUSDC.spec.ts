import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TransferUSDC, CCIPLocalSimulator, LinkTokenInterface, BasicMessageReceiver, IRouterClient, IERC20 } from "../typechain-types";
import { ccip } from "../typechain-types/@chainlink/local/src";

describe("TransferUSDC", function () {
  async function deployFixture() {
    const [owner, receiver] = await ethers.getSigners();


    const ccipLocalSimualtorFactory = await ethers.getContractFactory(
        "CCIPLocalSimulator"
      );
      const ccipLocalSimulator: CCIPLocalSimulator =
        await ccipLocalSimualtorFactory.deploy();


    const config: {
        chainSelector_: bigint;
        sourceRouter_: string;
        destinationRouter_: string;
        wrappedNative_: string;
        linkToken_: string;
        ccipBnM_: string;
        ccipLnM_: string;
        } = await ccipLocalSimulator.configuration();


    const basicMessageReceiverFactory = await ethers.getContractFactory(
        "BasicMessageReceiver"
        );

    
    const mockCcipRouterFactory = await ethers.getContractFactory(
        "MockCCIPRouter"
        );
    const mockCcipRouter = mockCcipRouterFactory.attach(
        config.sourceRouter_
        ) as IRouterClient;
    const mockCcipRouterAddress = await mockCcipRouter.getAddress();

    const basicMessageReceiver: BasicMessageReceiver =
    await basicMessageReceiverFactory.deploy(mockCcipRouter);
    const basicMessageReceiverAddress = await basicMessageReceiver.getAddress();

    // Mock USDC token
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy(10000000000)


    // Deploy actual contracts
    const TransferUSDC = await ethers.getContractFactory("TransferUSDC");
    const transferUSDC = await TransferUSDC.deploy(
      mockCcipRouter,
      config.linkToken_,
      await mockUSDC.getAddress()
    );

    // Setup
    const destinationChainSelector = 1 // Example chain selector

    return { 
      transferUSDC, 
      basicMessageReceiver, 
      ccipLocalSimulator, 
      mockUSDC, 
      owner, 
      receiver, 
      destinationChainSelector,
      mockCcipRouter
    };
  }

  it("Should transfer USDC cross-chain", async function () {
    const { 
      transferUSDC, 
      basicMessageReceiver, 
      ccipLocalSimulator,
      mockUSDC, 
      owner, 
      receiver, 
      destinationChainSelector,
      mockCcipRouter 
    } = await loadFixture(deployFixture);



    const transferAmount = ethers.parseUnits("100", 6); // 100 USDC

    // AllowlistDestinationChain
    await transferUSDC.allowlistDestinationChain(destinationChainSelector, true);

    // Approve USDC amount
    await mockUSDC.approve(await transferUSDC.getAddress(), transferAmount);
    

    // Transfer USDC
    const tx = await transferUSDC.transferUsdc(
      destinationChainSelector,
      // receiver.address,
      await basicMessageReceiver.getAddress(),
      transferAmount,
      500000, // gasLimit 
    );

     const gasUsageReport = []; // To store reports of gas used for each test.
 


    // Retrieve gas used from the last message executed by querying the router's events.
    const mockRouterEvents = await mockCcipRouter.queryFilter(
        mockCcipRouter.filters.MessageExecuted
    );
    const mockRouterEvent = mockRouterEvents[mockRouterEvents.length - 1]; // check last event
    const gasUsed = mockRouterEvent.args.gasUsed;

    // Push the report of iterations and gas used to the array.
    gasUsageReport.push({
        gasUsed: gasUsed.toString(),
    });
     
 
     // Log the final report of gas usage for each iteration.
     console.log("Final Gas Usage Report:");
     gasUsageReport.forEach((report) => {
       console.log(
         "Gas used: %d",
         report.gasUsed
       );
     });

  });
});
