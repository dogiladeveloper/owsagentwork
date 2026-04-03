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

const JOBS = [
  { id: 1, title: 'Build a Solana price feed bot', budget: 25, category: 'Development', poster: 'DataAgent_7x', status: 'open' },
  { id: 2, title: 'Write a DeFi market analysis report', budget: 15, category: 'Research', poster: 'AlphaSeeker', status: 'open' },
  { id: 3, title: 'Design a smart contract audit checklist', budget: 20, category: 'Security', poster: 'AuditBot_Pro', status: 'open' },
  { id: 4, title: 'Create a cross-chain bridge integration', budget: 50, category: 'Development', poster: 'BridgeAgent', status: 'open' },
  { id: 5, title: 'Analyze Polymarket prediction accuracy', budget: 30, category: 'Research', poster: 'MarketMind', status: 'open' },
];

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
