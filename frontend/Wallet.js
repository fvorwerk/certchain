function Wallet() {
  const [studentId, setStudentId] = React.useState('');
  const [certificates, setCertificates] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [activeNode, setActiveNode] = React.useState('http://localhost:3001');
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [selectedCertificate, setSelectedCertificate] = React.useState(null);
  const [credits, setCredits] = React.useState(0);
  const [purchaseAmount, setPurchaseAmount] = React.useState(10);
  const [transactions, setTransactions] = React.useState([]);
  const [showTransactions, setShowTransactions] = React.useState(false);
  
  // Function to parse query parameters
  const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  };
  
  // Check for direct wallet access via URL
  React.useEffect(() => {
    const userParam = getQueryParam('user');
    if (userParam) {
      setStudentId(userParam);
      setTimeout(() => {
        fetchCertificates(userParam);
        fetchCredits(userParam);
        fetchTransactions(userParam);
      }, 500);
    }
  }, []);
  
  const fetchCertificates = async (id = null) => {
    const idToUse = id || studentId;
    
    if (!idToUse.trim()) {
      setError('Please enter a student ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${activeNode}/wallet/${encodeURIComponent(idToUse)}`);
      setCertificates(response.data.certificates || []);
      setIsLoggedIn(true);
      setStudentId(idToUse);
    } catch (err) {
      setError(`Failed to fetch certificates: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch credits for a user
  const fetchCredits = async (id = null) => {
    const idToUse = id || studentId;
    
    if (!idToUse.trim()) return;
    
    try {
      // First ensure the wallet is registered on the network
      await registerWallet(idToUse);
      
      const response = await axios.get(`${activeNode}/credits/${encodeURIComponent(idToUse)}`);
      setCredits(response.data.balance);
    } catch (err) {
      console.error('Failed to fetch credits:', err.message);
    }
  };
  
  // Register wallet on the network if it doesn't exist
  const registerWallet = async (walletId) => {
    try {
      await axios.post(`${activeNode}/wallets/register`, { walletId });
      console.log(`Wallet ${walletId} registered on the network`);
    } catch (err) {
      console.error('Failed to register wallet:', err.message);
    }
  };
  
  // Add a refresh balance button to the credit section
  const refreshBalance = async () => {
    if (!studentId.trim()) return;
    
    try {
      setLoading(true);
      await fetchCredits();
      await fetchTransactions();
      setLoading(false);
    } catch (err) {
      console.error('Failed to refresh balance:', err.message);
      setLoading(false);
    }
  };
  
  // Fetch transaction history
  const fetchTransactions = async (id = null) => {
    const idToUse = id || studentId;
    
    if (!idToUse.trim()) return;
    
    try {
      const response = await axios.get(`${activeNode}/credits/transactions/${encodeURIComponent(idToUse)}`);
      setTransactions(response.data.transactions || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err.message);
    }
  };
  
  // Purchase credits
  const purchaseCredits = async () => {
    if (!studentId.trim() || purchaseAmount <= 0) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${activeNode}/credits/purchase`, {
        walletId: studentId,
        amount: purchaseAmount,
        paymentReference: `PURCHASE-${Date.now()}`
      });
      
      if (response.data.success) {
        setCredits(response.data.newBalance);
        alert(`Successfully purchased ${purchaseAmount} credits!`);
        fetchTransactions();
      }
    } catch (err) {
      setError(`Failed to purchase credits: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogin = (e) => {
    e.preventDefault();
    fetchCertificates();
    fetchCredits();
    fetchTransactions();
  };
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCertificates([]);
    setSelectedCertificate(null);
    // Clear URL params on logout
    window.history.replaceState({}, document.title, window.location.pathname);
  };
  
  const switchToWallet = (userId) => {
    window.location.href = `wallet.html?user=${userId}`;
  };
  
  const viewCertificate = (cert) => {
    setSelectedCertificate(cert);
  };
  
  const closeModal = () => {
    setSelectedCertificate(null);
  };
  
  const renderLogin = () => (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card">
          <div className="card-header bg-primary text-white">
            <h3 className="mb-0">Certificate Wallet</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label htmlFor="studentId" className="form-label">Enter your Student ID or Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="studentId"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g., S1234 or John Smith"
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="nodeUrl" className="form-label">Blockchain Node</label>
                <select
                  className="form-select"
                  id="nodeUrl"
                  value={activeNode}
                  onChange={(e) => setActiveNode(e.target.value)}
                >
                  <option value="http://localhost:3001">Node 1 (3001)</option>
                  <option value="http://localhost:3002">Node 2 (3002)</option>
                  <option value="http://localhost:3003">Node 3 (3003)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Loading...' : 'View My Certificates'}
              </button>
              
              <hr className="my-4" />
              
              <div className="d-grid gap-2">
                <h5>Quick Access</h5>
                <button 
                  type="button" 
                  className="btn btn-outline-primary" 
                  onClick={() => switchToWallet('S1001')}
                >
                  Alice's Wallet (S1001)
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-primary" 
                  onClick={() => switchToWallet('S2002')}
                >
                  Bob's Wallet (S2002)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderCreditSection = () => (
    <div className="card mb-4">
      <div className="card-header bg-success text-white">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Credit Balance</h5>
          <div>
            <button 
              className="btn btn-sm btn-light me-2" 
              onClick={refreshBalance}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <span className="badge bg-light text-dark">{credits} Credits</span>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-8">
            <div className="input-group mb-3">
              <input
                type="number"
                className="form-control"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(parseInt(e.target.value) || 0)}
                min="1"
              />
              <button 
                className="btn btn-primary" 
                onClick={purchaseCredits}
                disabled={loading}
              >
                Purchase Credits
              </button>
            </div>
            <small className="text-muted">Each certificate costs 1 credit</small>
          </div>
          <div className="col-md-4 text-end">
            <button 
              className="btn btn-outline-secondary"
              onClick={() => {
                setShowTransactions(!showTransactions);
                if (!showTransactions) fetchTransactions();
              }}
            >
              {showTransactions ? 'Hide History' : 'Transaction History'}
            </button>
          </div>
        </div>
        
        {showTransactions && (
          <div className="mt-3">
            <h6>Transaction History</h6>
            {transactions.length === 0 ? (
              <p className="text-muted">No transactions yet</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.timestamp).toLocaleDateString()}</td>
                        <td>{tx.type}</td>
                        <td className={tx.amount > 0 ? 'text-success' : 'text-danger'}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </td>
                        <td>{tx.balanceAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
  
  const renderCertificateList = () => (
    <div className="row">
      <div className="col-12 mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <h2>Your Certificates ({certificates.length})</h2>
          <div>
            <button className="btn btn-outline-primary me-2" onClick={() => switchToWallet('S1001')}>
              Alice's Wallet
            </button>
            <button className="btn btn-outline-primary me-2" onClick={() => switchToWallet('S2002')}>
              Bob's Wallet
            </button>
            <button className="btn btn-outline-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
        <p className="text-muted">Student ID/Name: {studentId}</p>
      </div>
      
      <div className="col-12">
        {renderCreditSection()}
      </div>
      
      {certificates.length === 0 ? (
        <div className="col-12">
          <div className="alert alert-info">
            No certificates found for this student ID or name.
          </div>
        </div>
      ) : (
        certificates.map((cert, index) => (
          <div className="col-md-6 col-lg-4 mb-4" key={index}>
            <div className="card h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">{cert.certificate.type || 'Certificate'}</h5>
              </div>
              <div className="card-body">
                <p><strong>ID:</strong> {cert.certificate.certificateId || 'N/A'}</p>
                <p><strong>Subject:</strong> {cert.certificate.subject || 'N/A'}</p>
                <p><strong>Institution:</strong> {cert.certificate.institution && cert.certificate.institution.name ? cert.certificate.institution.name : 'N/A'}</p>
                <p><strong>Issue Date:</strong> {cert.certificate.issueDate || new Date(cert.timestamp).toLocaleDateString()}</p>
              </div>
              <div className="card-footer">
                <button className="btn btn-primary w-100" onClick={() => viewCertificate(cert)}>
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))
      )}
      
      {selectedCertificate && (
        <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedCertificate.certificate.type || 'Certificate'}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <div className="certificate-detail p-4 border rounded mb-4">
                  <div className="text-center mb-4">
                    <h2>{selectedCertificate.certificate.institution && selectedCertificate.certificate.institution.name ? selectedCertificate.certificate.institution.name : 'Institution'}</h2>
                    <h4>{selectedCertificate.certificate.type}</h4>
                    <p className="text-muted">This certifies that</p>
                    <h3>{selectedCertificate.certificate.student && selectedCertificate.certificate.student.fullName ? selectedCertificate.certificate.student.fullName : studentId}</h3>
                    <p>has successfully completed the requirements for</p>
                    <h4>{selectedCertificate.certificate.subject}</h4>
                    <p>with grade: <strong>{selectedCertificate.certificate.grade || 'Pass'}</strong></p>
                    <p>Issued on: {selectedCertificate.certificate.issueDate || new Date(selectedCertificate.timestamp).toLocaleDateString()}</p>
                    <p>Signed by: {selectedCertificate.certificate.signedBy || 'Authorized Signatory'}</p>
                  </div>
                  
                  <hr />
                  
                  <div className="blockchain-info mt-4">
                    <h5>Blockchain Verification</h5>
                    <p><strong>Certificate ID:</strong> {selectedCertificate.certificate.certificateId}</p>
                    <p><strong>Block #:</strong> {selectedCertificate.blockIndex}</p>
                    <p><strong>Block Hash:</strong> <code>{selectedCertificate.blockHash}</code></p>
                    <p><strong>Timestamp:</strong> {new Date(selectedCertificate.timestamp).toLocaleString()}</p>
                    {selectedCertificate.certificate.metadata && selectedCertificate.certificate.metadata.verificationUrl && (
                      <p>
                        <strong>Verification URL:</strong> 
                        <a href={selectedCertificate.certificate.metadata.verificationUrl} target="_blank" rel="noopener noreferrer">
                          {selectedCertificate.certificate.metadata.verificationUrl}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Close</button>
                <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print Certificate</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  return (
    <div className="container mt-5">
      {isLoggedIn ? renderCertificateList() : renderLogin()}
      {error && (
        <div className="alert alert-danger mt-4">
          {error}
        </div>
      )}
    </div>
  );
}