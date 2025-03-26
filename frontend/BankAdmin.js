function BankAdmin() {
  const [activeNode, setActiveNode] = React.useState('http://localhost:3001');
  const [bankStats, setBankStats] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [walletId, setWalletId] = React.useState('');
  const [tokenAmount, setTokenAmount] = React.useState(5);
  const [issueReason, setIssueReason] = React.useState('Bank Admin Issuance');
  const [walletTokens, setWalletTokens] = React.useState([]);
  const [walletDetails, setWalletDetails] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [allTransactions, setAllTransactions] = React.useState([]);
  const [searchWalletId, setSearchWalletId] = React.useState('');
  const [transferToWallet, setTransferToWallet] = React.useState('');
  const [transferAmount, setTransferAmount] = React.useState(1);
  
  // Chart reference
  const chartRef = React.useRef(null);
  const chartInstance = React.useRef(null);
  
  // Fetch bank statistics
  const fetchBankStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${activeNode}/ledger/info`);
      
      // Ensure response data has all required properties
      const data = response.data || {};
      
      // Initialize walletBalances if missing
      if (!data.walletBalances) {
        const ledgerInfo = data.ledgerInfo || {};
        const walletDetails = data.walletDetails || {};
        
        // Create a walletBalances object from walletDetails if available
        data.walletBalances = {};
        Object.keys(walletDetails).forEach(walletId => {
          const wallet = walletDetails[walletId];
          if (wallet && typeof wallet.activeTokens === 'number') {
            data.walletBalances[walletId] = wallet.activeTokens;
          }
        });
      }
      
      setBankStats(data);
      
      // Also get a sample of all transactions
      const txResponse = await axios.get(`${activeNode}/admin/transactions`);
      setAllTransactions(txResponse.data.transactions || []);
      
      // Update chart if we're on the dashboard
      if (activeTab === 'dashboard' && chartRef.current) {
        updateChart(data);
      }
    } catch (err) {
      setError(`Failed to fetch bank statistics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch wallet tokens
  const fetchWalletTokens = async (id = walletId) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${activeNode}/credits/${id}/tokens`);
      setWalletTokens(response.data.tokens || []);
      setWalletDetails(id);
    } catch (err) {
      setError(`Failed to fetch wallet tokens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Issue new tokens
  const issueTokens = async () => {
    if (!walletId || tokenAmount <= 0) {
      setError('Valid wallet ID and positive amount required');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${activeNode}/admin/credits/issue`, {
        walletId,
        amount: tokenAmount,
        reason: issueReason
      });
      
      if (response.data.success) {
        alert(`Successfully issued ${tokenAmount} tokens to wallet ${walletId}`);
        fetchBankStats();
        fetchWalletTokens();
      }
    } catch (err) {
      const errorMsg = err.response && err.response.data && err.response.data.error ? 
                       err.response.data.error : err.message;
      setError(`Failed to issue tokens: ${errorMsg}`);
      console.error('Token issue error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Transfer tokens between wallets
  const transferTokens = async () => {
    if (!walletDetails || !transferToWallet || transferAmount <= 0) {
      setError('Valid wallet IDs and positive amount required');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${activeNode}/credits/transfer`, {
        fromWalletId: walletDetails,
        toWalletId: transferToWallet,
        amount: transferAmount
      });
      
      if (response.data.success) {
        alert(`Successfully transferred ${transferAmount} tokens from ${walletDetails} to ${transferToWallet}`);
        fetchWalletTokens();
        setTransferToWallet('');
        setTransferAmount(1);
      }
    } catch (err) {
      const errorMsg = err.response && err.response.data && err.response.data.error ? 
                       err.response.data.error : err.message;
      setError(`Failed to transfer tokens: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Search for a specific wallet
  const handleWalletSearch = (e) => {
    e.preventDefault();
    if (searchWalletId) {
      fetchWalletTokens(searchWalletId);
      setWalletId(searchWalletId);
    }
  };
  
  // Update the chart with new data
  const updateChart = (data) => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const ctx = chartRef.current.getContext('2d');
    
    // Prepare data for the chart - ensure walletBalances exists
    const walletBalances = data && data.walletBalances || {};
    const walletLabels = Object.keys(walletBalances).slice(0, 10);
    const balanceData = walletLabels.map(id => walletBalances[id]);
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: walletLabels,
        datasets: [{
          label: 'Wallet Token Balances',
          data: balanceData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  };
  
  // Tab change effect
  React.useEffect(() => {
    if (activeTab === 'dashboard' && bankStats && chartRef.current) {
      updateChart(bankStats);
    }
  }, [activeTab, bankStats]);
  
  // Reset all credits in the system
  const resetCredits = async () => {
    if (!confirm('This action will reset ALL credit tokens. Are you sure?')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${activeNode}/admin/reset-credits`);
      if (response.data.success) {
        alert('Credits reset successfully. You may need to restart the system.');
        fetchBankStats();
      }
    } catch (err) {
      setError(`Failed to reset credits: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  React.useEffect(() => {
    fetchBankStats();
  }, [activeNode]);
  
  // Render the dashboard
  const renderDashboard = () => (
    <div className="dashboard">
      {bankStats && (
        <div>
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card stat-card">
                <div className="card-body">
                  <h5 className="card-title">Total Tokens</h5>
                  <h3>{bankStats.totalTokens}</h3>
                  <p className="text-muted">Active: {bankStats.activeTokens} / Spent: {bankStats.spentTokens}</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card stat-card">
                <div className="card-body">
                  <h5 className="card-title">Wallets</h5>
                  <h3>{bankStats.walletCount}</h3>
                  <p className="text-muted">With active tokens</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card stat-card">
                <div className="card-body">
                  <h5 className="card-title">Transactions</h5>
                  <h3>{allTransactions.length}</h3>
                  <p className="text-muted">Last 24 hours</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card stat-card">
                <div className="card-body">
                  <h5 className="card-title">Certificate Cost</h5>
                  <h3>1 Token</h3>
                  <p className="text-muted">Per certificate</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="row mb-4">
            <div className="col-md-8">
              <div className="card">
                <div className="card-header">
                  <h5>Token Distribution</h5>
                </div>
                <div className="card-body">
                  <canvas ref={chartRef} height="250"></canvas>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card">
                <div className="card-header">
                  <h5>Recent Transactions</h5>
                </div>
                <div className="card-body">
                  <div className="list-group">
                    {allTransactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className="list-group-item">
                        <div className="d-flex w-100 justify-content-between">
                          <h6 className="mb-1">{tx.type}</h6>
                          <small>{new Date(tx.timestamp).toLocaleDateString()}</small>
                        </div>
                        <p className="mb-1">Wallet: {tx.walletId}</p>
                        <small>Amount: {tx.amount}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  // Render the issue tokens form
  const renderIssueTokens = () => (
    <div className="card">
      <div className="card-header">
        <h5>Issue New Tokens</h5>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label className="form-label">Wallet ID</label>
          <input
            type="text"
            className="form-control"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            placeholder="e.g., S1001"
          />
          <div className="form-text">Enter the wallet ID to issue tokens to</div>
        </div>
        <div className="mb-3">
          <label className="form-label">Token Amount</label>
          <input
            type="number"
            className="form-control"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
            min="1"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Reason</label>
          <input
            type="text"
            className="form-control"
            value={issueReason}
            onChange={(e) => setIssueReason(e.target.value)}
          />
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={issueTokens}
          disabled={loading || !walletId || tokenAmount <= 0}
        >
          {loading ? 'Processing...' : 'Issue Tokens'}
        </button>
      </div>
    </div>
  );
  
  // Render wallet management
  const renderWalletManagement = () => (
    <div className="wallet-management-container">
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5>Search Wallet</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleWalletSearch}>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter wallet ID"
                    value={searchWalletId}
                    onChange={(e) => setSearchWalletId(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit">
                    Search
                  </button>
                </div>
                <div className="form-text">
                  Quick access: 
                  <button 
                    type="button" 
                    className="btn btn-link btn-sm"
                    onClick={() => {
                      setSearchWalletId('S1001');
                      fetchWalletTokens('S1001');
                    }}
                  >
                    Alice (S1001)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-link btn-sm"
                    onClick={() => {
                      setSearchWalletId('S2002');
                      fetchWalletTokens('S2002');
                    }}
                  >
                    Bob (S2002)
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        {walletDetails && (
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5>Transfer Tokens</h5>
              </div>
              <div className="card-body">
                <p>From: <strong>{walletDetails}</strong> (Balance: {walletTokens.filter(t => !t.spent).length} tokens)</p>
                <div className="mb-3">
                  <label className="form-label">To Wallet</label>
                  <input
                    type="text"
                    className="form-control"
                    value={transferToWallet}
                    onChange={(e) => setTransferToWallet(e.target.value)}
                    placeholder="Recipient wallet ID"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    className="form-control"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)}
                    min="1"
                    max={walletTokens.filter(t => !t.spent).length}
                  />
                </div>
                
                <button 
                  className="btn btn-warning" 
                  onClick={transferTokens}
                  disabled={loading || !transferToWallet || transferAmount <= 0}
                >
                  Transfer Tokens
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {walletDetails && (
        <div className="card">
          <div className="card-header">
            <h5>Wallet Tokens for {walletDetails}</h5>
            <span className="badge bg-success ms-2">{walletTokens.filter(t => !t.spent).length} available</span>
          </div>
          <div className="card-body">
            {walletTokens.length > 0 ? (
              <div className="token-grid">
                {walletTokens.map(token => (
                  <div key={token.tokenId} className={`token-card ${token.spent ? 'spent' : ''}`}>
                    <div className="token-status mb-2">
                      {token.spent ? (
                        <span className="badge bg-secondary">Spent</span>
                      ) : (
                        <span className="badge bg-success">Active</span>
                      )}
                    </div>
                    <div className="token-id">{token.tokenId.substring(0, 8)}...</div>
                    <small>{new Date(token.issueTimestamp).toLocaleDateString()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>No tokens found for this wallet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
  
  return (
    <div className="container">
      <h1 className="mb-4">CertChain Bank Administration</h1>
      
      <div className="row mb-4">
        <div className="col-md-9">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'issue' ? 'active' : ''}`}
                onClick={() => setActiveTab('issue')}
              >
                Issue Tokens
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'wallets' ? 'active' : ''}`}
                onClick={() => setActiveTab('wallets')}
              >
                Wallet Management
              </button>
            </li>
          </ul>
        </div>
        <div className="col-md-3">
          <select 
            className="form-select"
            value={activeNode}
            onChange={(e) => setActiveNode(e.target.value)}
          >
            <option value="http://localhost:3001">Node 1 (3001)</option>
            <option value="http://localhost:3002">Node 2 (3002)</option>
            <option value="http://localhost:3003">Node 3 (3003)</option>
          </select>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}
      
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'issue' && renderIssueTokens()}
      {activeTab === 'wallets' && renderWalletManagement()}
      
      <div className="mt-4 d-flex justify-content-between">
        <button 
          className="btn btn-danger" 
          onClick={resetCredits}
          disabled={loading}
        >
          Reset All Credits
        </button>
        
        <button
          className="btn btn-outline-primary"
          onClick={fetchBankStats}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
}