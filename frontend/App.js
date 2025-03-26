function App() {
  const [activeNode, setActiveNode] = React.useState('http://localhost:3001');
  const [nodes, setNodes] = React.useState([]);
  const [blockchain, setBlockchain] = React.useState({ chain: [], length: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [refreshInterval, setRefreshInterval] = React.useState(5);
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true);
  const [certificate, setCertificate] = React.useState({
    id: `cert-${Date.now()}`,
    name: 'Sample Certificate',
    data: 'Sample certificate data',
    student: {
      id: '',
      fullName: ''
    },
    type: 'Generic Certificate',
    subject: '',
    institution: {
      name: '',
      location: ''
    }
  });
  const [walletCredits, setWalletCredits] = React.useState({});

  // Function to fetch blockchain data
  const fetchBlockchain = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${activeNode}/chain`);
      setBlockchain(response.data);
    } catch (err) {
      setError(`Failed to fetch blockchain: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch nodes
  const fetchNodes = async () => {
    try {
      const response = await axios.get(`${activeNode}/nodes`);
      setNodes(response.data.nodes || []);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  };

  // Function to fetch credit balance for a wallet
  const fetchWalletCredits = async (walletId) => {
    if (!walletId) return;
    
    try {
      const response = await axios.get(`${activeNode}/credits/${encodeURIComponent(walletId)}`);
      setWalletCredits(prev => ({
        ...prev,
        [walletId]: response.data.balance
      }));
      return response.data.balance;
    } catch (err) {
      console.error(`Failed to fetch credits for wallet ${walletId}:`, err.message);
      return 0;
    }
  };

  // Function to add a certificate with credit check
  const addCertificate = async () => {
    setLoading(true);
    
    try {
      if (certificate.student && certificate.student.id) {
        // Check credit balance first
        const balance = await fetchWalletCredits(certificate.student.id);
        
        if (balance < 1) {
          setError(`Wallet ${certificate.student.id} has insufficient credits (${balance}). Each certificate costs 1 credit.`);
          setLoading(false);
          return;
        }
      }
      
      // Send request with wallet ID
      await axios.post(`${activeNode}/certificates`, { 
        certificate,
        walletId: certificate.student.id
      });
      
      alert('Certificate added successfully!');
      
      // Refresh the wallet credits if we spent any
      if (certificate.student && certificate.student.id) {
        fetchWalletCredits(certificate.student.id);
      }
      
      // Generate a new random certificate ID for next submission
      setCertificate({
        ...certificate,
        id: `cert-${Date.now()}`
      });
      
      fetchBlockchain();
    } catch (err) {
      if (err.response && err.response.status === 402) {
        setError(`Payment required: ${err.response.data.error}. Current balance: ${err.response.data.currentBalance}`);
      } else {
        setError(`Failed to add certificate: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to mine a block
  const mineBlock = async () => {
    setLoading(true);
    try {
      await axios.post(`${activeNode}/mine`);
      alert('Block mined successfully!');
      fetchBlockchain();
    } catch (err) {
      setError(`Failed to mine block: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to trigger consensus
  const resolveConsensus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${activeNode}/nodes/resolve`);
      alert(response.data.message);
      fetchBlockchain();
    } catch (err) {
      setError(`Failed to resolve consensus: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change for certificate
  const handleCertificateChange = (e) => {
    const { name, value } = e.target;
    
    // Handle nested objects in state
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setCertificate({
        ...certificate,
        [parent]: {
          ...certificate[parent],
          [child]: value
        }
      });
    } else {
      setCertificate({
        ...certificate,
        [name]: value
      });
    }
  };

  // Initial data fetch
  React.useEffect(() => {
    fetchBlockchain();
    fetchNodes();
  }, [activeNode]);

  // Auto-refresh setup
  React.useEffect(() => {
    let interval;
    if (isAutoRefresh) {
      interval = setInterval(() => {
        fetchBlockchain();
        fetchNodes();
      }, refreshInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshInterval, activeNode]);

  // Render certificate data
  const renderCertificate = (cert) => {
    // Handle credit operations
    if (cert.type === 'CREDIT_OPERATION') {
      return (
        <div className="certificate credit-operation">
          <div><strong>Type:</strong> Credit {cert.operation}</div>
          <div><strong>Token ID:</strong> {cert.tokenData && cert.tokenData.token && cert.tokenData.token.tokenId || 'N/A'}</div>
          <div><strong>Wallet:</strong> {cert.tokenData && cert.tokenData.token && cert.tokenData.token.ownerWalletId || 'N/A'}</div>
          <div><strong>Timestamp:</strong> {new Date(cert.timestamp).toLocaleString()}</div>
          {cert.operation === 'TRANSFER' && cert.tokenData && cert.tokenData.token && cert.tokenData.token.transferHistory && 
           cert.tokenData.token.transferHistory.length > 0 && (
            <div><strong>Transfer:</strong> From {cert.tokenData.token.transferHistory[cert.tokenData.token.transferHistory.length-1].fromWalletId}</div>
          )}
          {cert.operation === 'SPEND' && (
            <div><strong>Spent On:</strong> {cert.tokenData && cert.tokenData.token && cert.tokenData.token.spentOn || 'Unknown'}</div>
          )}
        </div>
      );
    }

    // Handle regular certificates
    if (!cert || !cert.certificate) {
      return (
        <div className="certificate">
          <div><strong>Invalid Certificate Data</strong></div>
        </div>
      );
    }
    
    const certificate = cert.certificate;
    
    return (
      <div className="certificate">
        <div><strong>ID:</strong> {certificate.id || certificate.certificateId || 'N/A'}</div>
        <div><strong>Name:</strong> {certificate.name || 'N/A'}</div>
        <div><strong>Data:</strong> {certificate.data || 'N/A'}</div>
        {certificate.type && <div><strong>Type:</strong> {certificate.type}</div>}
        {certificate.headline && <div><strong>Headline:</strong> {certificate.headline}</div>}
        <div><strong>Timestamp:</strong> {new Date(cert.timestamp).toLocaleString()}</div>
        {certificate.student && (
          <div><strong>Student:</strong> {certificate.student.fullName} ({certificate.student.id})</div>
        )}
        {certificate.institution && (
          <div><strong>Institution:</strong> {certificate.institution.name}</div>
        )}
        {certificate.subject && (
          <div><strong>Subject:</strong> {certificate.subject}</div>
        )}
      </div>
    );
  };

  // Render a block
  const renderBlock = (block, index) => {
    const isGenesis = block.index === 0;
    
    // Count different types of entries
    const creditOps = block.data.filter(entry => entry.type === 'CREDIT_OPERATION').length;
    const certificates = block.data.length - creditOps;
    
    return (
      <div key={block.index} className={`block ${isGenesis ? 'genesis' : ''}`}>
        <h4>Block #{block.index} {isGenesis && '(Genesis)'}</h4>
        <div className="timestamp">
          Created: {new Date(block.timestamp).toLocaleString()}
        </div>
        
        <div className="mt-2">
          <strong>Previous Hash:</strong>
          <div className="hash-display">{block.previousHash}</div>
        </div>
        
        <div className="mt-2">
          <strong>Hash:</strong>
          <div className="hash-display">{block.hash}</div>
        </div>

        <h5 className="mt-3">Entries: {block.data.length} 
          {creditOps > 0 && <span className="badge bg-info ms-2">{creditOps} Credits</span>}
          {certificates > 0 && <span className="badge bg-success ms-2">{certificates} Certificates</span>}
        </h5>
        
        {block.data.length > 0 ? (
          block.data.map((entry, i) => (
            <div key={i} className="mb-2">
              {renderCertificate(entry)}
            </div>
          ))
        ) : (
          <p>No data in this block</p>
        )}
        
        {/* Hash link connecting to next block */}
        {index < blockchain.chain.length - 1 && <div className="hash-link"></div>}
      </div>
    );
  };

  return (
    <div className="container">
      <div className="row mt-4">
        <div className="col-12">
          <h1 className="text-center">CertChain Blockchain Visualizer</h1>
          <p className="text-center">
            Currently connected to: {activeNode}
            <span className={`refresh-indicator ${loading ? 'loading' : ''}`}></span>
          </p>
          {error && (
            <div className="alert alert-danger">{error}</div>
          )}
        </div>
      </div>

      <div className="row">
        <div className="col-md-3">
          <div className="card">
            <div className="card-header">
              Controls
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Active Node:</label>
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

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="autoRefresh"
                    checked={isAutoRefresh}
                    onChange={() => setIsAutoRefresh(!isAutoRefresh)}
                  />
                  <label className="form-check-label" htmlFor="autoRefresh">
                    Auto Refresh
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Refresh Interval (seconds):</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  min="1"
                />
              </div>

              <button className="btn btn-primary mb-2 w-100" onClick={fetchBlockchain}>
                Refresh Data
              </button>
              <button className="btn btn-success mb-2 w-100" onClick={mineBlock}>
                Mine Block
              </button>
              <button className="btn btn-info mb-2 w-100" onClick={resolveConsensus}>
                Resolve Consensus
              </button>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">
              Add Certificate
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Certificate ID:</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="id"
                  value={certificate.id}
                  onChange={handleCertificateChange}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Certificate Name:</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="name"
                  value={certificate.name}
                  onChange={handleCertificateChange}
                />
              </div>
              
              <hr className="my-3" />
              <h5>Student Information</h5>
              
              <div className="mb-3">
                <label className="form-label">Student ID:</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    className="form-control"
                    name="student.id"
                    value={certificate.student.id}
                    onChange={handleCertificateChange}
                    placeholder="e.g., S1001 for Alice, S2002 for Bob"
                  />
                  <button 
                    className="btn btn-outline-secondary" 
                    type="button"
                    onClick={() => fetchWalletCredits(certificate.student.id)}
                  >
                    Check Credits
                  </button>
                </div>
                {certificate.student.id && walletCredits[certificate.student.id] !== undefined && (
                  <div className="form-text">
                    Credit Balance: <span className={walletCredits[certificate.student.id] < 1 ? 'text-danger' : 'text-success'}>
                      {walletCredits[certificate.student.id]} credits
                    </span>
                    {walletCredits[certificate.student.id] < 1 && (
                      <span className="text-danger"> (Insufficient for certificate creation)</span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mb-3">
                <label className="form-label">Student Name:</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="student.fullName"
                  value={certificate.student.fullName}
                  onChange={handleCertificateChange}
                  placeholder="e.g., Alice Johnson or Bob Smith"
                />
              </div>
              
              <hr className="my-3" />
              <h5>Certificate Details</h5>
              
              <div className="mb-3">
                <label className="form-label">Type:</label>
                <select
                  className="form-select"
                  name="type"
                  value={certificate.type}
                  onChange={handleCertificateChange}
                >
                  <option value="Bachelor's Degree">Bachelor's Degree</option>
                  <option value="Master's Degree">Master's Degree</option>
                  <option value="Professional Certification">Professional Certification</option>
                  <option value="Course Completion">Course Completion</option>
                  <option value="Workshop Attendance">Workshop Attendance</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Subject/Field:</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="subject"
                  value={certificate.subject}
                  onChange={handleCertificateChange}
                  placeholder="e.g., Computer Science, Business Administration"
                />
              </div>
              
              <div className="mb-3">
                <label className="form-label">Institution:</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="institution.name"
                  value={certificate.institution.name}
                  onChange={handleCertificateChange}
                  placeholder="e.g., University of Technology"
                />
              </div>
              
              <div className="mb-3">
                <label className="form-label">Location:</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="institution.location"
                  value={certificate.institution.location}
                  onChange={handleCertificateChange}
                  placeholder="e.g., New York, USA"
                />
              </div>
              
              <div className="mb-3">
                <label className="form-label">Additional Data:</label>
                <textarea 
                  className="form-control"
                  name="data"
                  value={certificate.data}
                  onChange={handleCertificateChange}
                  rows="3"
                ></textarea>
              </div>
              
              <button 
                className="btn btn-primary w-100" 
                onClick={addCertificate}
                disabled={loading || (certificate.student.id && walletCredits[certificate.student.id] !== undefined && walletCredits[certificate.student.id] < 1)}
              >
                Add Certificate
              </button>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">
              Connected Nodes
            </div>
            <div className="card-body">
              {nodes.length > 0 ? (
                <ul className="list-group">
                  {nodes.map((node, idx) => (
                    <li key={idx} className="list-group-item">
                      {node}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No nodes registered</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-md-9">
          <div className="card">
            <div className="card-header">
              Blockchain ({blockchain.length} blocks)
            </div>
            <div className="card-body blockchain-container">
              {blockchain.chain && blockchain.chain.length > 0 ? (
                blockchain.chain.map((block, idx) => renderBlock(block, idx))
              ) : (
                <p>No blocks found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
