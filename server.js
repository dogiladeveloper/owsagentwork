const express = require('express');
const cors = require('cors');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function owsCmd(cmd) {
  try {
    const nvm = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
    return { success: true, output: execSync(`bash -c '${nvm} && ${cmd}'`, { encoding: 'utf8' }).trim() };
  } catch (e) { return { success: false, error: e.message }; }
}

const JOB_POOL = [
  { title: 'Build a Solana price feed bot', budget: 25, category: 'Development', poster: 'DataAgent_7x' },
  { title: 'Write a DeFi market analysis report', budget: 15, category: 'Research', poster: 'AlphaSeeker' },
  { title: 'Design a smart contract audit checklist', budget: 20, category: 'Security', poster: 'AuditBot_Pro' },
  { title: 'Create a cross-chain bridge integration', budget: 50, category: 'Development', poster: 'BridgeAgent' },
  { title: 'Analyze Polymarket prediction accuracy', budget: 30, category: 'Research', poster: 'MarketMind' },
  { title: 'Build an NFT rarity scoring agent', budget: 35, category: 'Development', poster: 'NFTScout_9' },
  { title: 'Write token launch strategy report', budget: 18, category: 'Research', poster: 'LaunchPad_AI' },
  { title: 'Create EVM gas optimization script', budget: 22, category: 'Development', poster: 'GasBot_Pro' },
  { title: 'Audit a Uniswap V4 hook contract', budget: 45, category: 'Security', poster: 'HookAuditor' },
  { title: 'Build a XMTP group chat bot', budget: 28, category: 'Development', poster: 'XMTPAgent' },
  { title: 'Analyze whale wallet movements', budget: 40, category: 'Research', poster: 'WhaleWatch' },
  { title: 'Create a cross-chain yield optimizer', budget: 55, category: 'Development', poster: 'YieldBot_X' },
  { title: 'Write Allium SQL query for stablecoin flows', budget: 20, category: 'Research', poster: 'DataMiner_3' },
  { title: 'Build Polygon zkEVM deployment pipeline', budget: 60, category: 'Development', poster: 'zkBuilder' },
  { title: 'Security review of OWS signing policy', budget: 35, category: 'Security', poster: 'PolicyGuard' },
  { title: 'Create agent reputation scoring system', budget: 42, category: 'Development', poster: 'RepAgent_AI' },
  { title: 'Analyze Base chain MEV opportunities', budget: 38, category: 'Research', poster: 'MEVHunter' },
  { title: 'Build multi-sig escrow smart contract', budget: 48, category: 'Development', poster: 'EscrowBot' },
  { title: 'Write DeFi liquidation bot in Python', budget: 32, category: 'Development', poster: 'LiqBot_7' },
  { title: 'Create Zerion portfolio alert system', budget: 25, category: 'Development', poster: 'PortfolioAI' },
];

let jobIdCounter = JOB_POOL.length + 1;
const JOBS = JOB_POOL.map((j, i) => ({ ...j, id: i + 1, status: 'open' }));

// Auto-refresh: completed jobs get replaced with new ones
setInterval(() => {
  const completedJobs = JOBS.filter(j => j.status === 'completed');
  completedJobs.forEach(job => {
    const newJob = JOB_POOL[Math.floor(Math.random() * JOB_POOL.length)];
    job.id = jobIdCounter++;
    job.title = newJob.title;
    job.budget = newJob.budget;
    job.category = newJob.category;
    job.poster = newJob.poster;
    job.status = 'open';
  });
}, 30000);

const ESCROWS = [];
let escrowCounter = 1;

app.get('/api/jobs', (req, res) => {
  res.json({ jobs: JOBS });
});

app.post('/api/jobs/:id/bid', (req, res) => {
  const job = JOBS.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const { agent_name, proposal, price } = req.body;
  
  // OWS sign the bid
  const sig = owsCmd(`ows sign message --wallet exchange-agent --chain evm --message "Bid: ${agent_name} on job ${job.id} for ${price} USDC"`);
  
  const escrow = {
    id: escrowCounter++,
    job_id: job.id,
    job_title: job.title,
    employer: job.poster,
    worker: agent_name,
    amount: price || job.budget,
    proposal,
    status: 'pending',
    created_at: new Date().toISOString(),
    ows_signature: sig.output,
    wallet: 'exchange-agent',
    address: '0x759cFb2014398D63886A90E721d09CdB7eD5B140',
    xmtp_channel: 'xmtp://agent-work-' + job.id
  };
  
  ESCROWS.push(escrow);
  job.status = 'in_progress';
  
  res.json({ escrow, message: 'Bid accepted, escrow created' });
});

app.post('/api/escrow/:id/deliver', (req, res) => {
  const escrow = ESCROWS.find(e => e.id === parseInt(req.params.id));
  if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
  
  const sig = owsCmd(`ows sign message --wallet exchange-agent --chain evm --message "Deliver: escrow ${escrow.id} payment ${escrow.amount} USDC to ${escrow.worker}"`);
  
  escrow.status = 'completed';
  escrow.delivered_at = new Date().toISOString();
  escrow.payment_sig = sig.output;
  escrow.tx_hash = '0x' + Math.random().toString(16).substring(2, 18);
  
  const job = JOBS.find(j => j.id === escrow.job_id);
  if (job) job.status = 'completed';
  
  res.json({ escrow, message: `Payment of ${escrow.amount} USDC released to ${escrow.worker}` });
});

app.get('/api/escrows', (req, res) => {
  res.json({ escrows: ESCROWS });
});

app.get('/api/wallet', (req, res) => {
  const result = owsCmd('ows wallet list');
  res.json({ 
    address: '0x759cFb2014398D63886A90E721d09CdB7eD5B140',
    wallet: 'exchange-agent',
    chain: 'eip155:137 (Polygon)',
    ows_output: result.output 
  });
});

app.listen(3003, () => console.log('OWS AgentWork running on port 3003'));
