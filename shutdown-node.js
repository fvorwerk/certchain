#!/usr/bin/env node

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get node number from command line argument
const nodeNumber = process.argv[2];

if (!nodeNumber || !['1', '2', '3'].includes(nodeNumber)) {
  console.error('Please specify a valid node number (1, 2, or 3)');
  process.exit(1);
}

const port = 3000 + parseInt(nodeNumber);

console.log(`Attempting to shut down Node ${nodeNumber} (PORT=${port})...`);

// First, let's try to find the process more explicitly
try {
  console.log('Method 1: Looking for exact process match...');
  const findCmd = `ps aux | grep "PORT=${port}" | grep -v grep`;
  const processes = execSync(findCmd, { encoding: 'utf8' });
  
  if (processes.trim()) {
    console.log('Found these matching processes:');
    console.log(processes);
    
    // Try multiple methods to kill the process
    try {
      console.log(`\nMethod 2: Using pkill with PORT pattern...`);
      execSync(`pkill -f "PORT=${port}"`, { stdio: 'inherit' });
      console.log('Process terminated successfully with pkill.');
    } catch (pkillError) {
      console.log('pkill method failed, trying alternative methods...');
      
      try {
        // Extract PID from ps output and kill directly
        console.log('\nMethod 3: Extracting PID and using direct kill...');
        const pidMatch = processes.match(/^\s*(\d+)/m);
        if (pidMatch && pidMatch[1]) {
          const pid = pidMatch[1];
          console.log(`Found PID: ${pid}, attempting to kill directly...`);
          execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
          console.log(`Process ${pid} terminated with kill -9.`);
        } else {
          throw new Error('Could not extract PID from process list');
        }
      } catch (killError) {
        console.error('All kill methods failed:', killError.message);
        
        // Last resort: try to kill all node processes (dangerous in production)
        console.log('\nMethod 4 (LAST RESORT): Stopping node process by PID directly...');
        try {
          // Find just the Node.js processes with their PIDs
          console.log('Looking for related Node.js processes:');
          const nodeProcesses = execSync(`ps aux | grep "node.*index.js" | grep -v grep`, { encoding: 'utf8' });
          console.log(nodeProcesses);
          
          console.log(`\nPlease manually kill the process using: kill -9 PID`);
          console.log(`where PID is the process ID from the list above.`);
        } catch (err) {
          console.error('Failed to list Node.js processes:', err.message);
        }
      }
    }
  } else {
    console.log(`No processes found running with PORT=${port}`);
    
    // Check if a log file exists, which might indicate the node was running
    const logFile = path.join(__dirname, `node${nodeNumber}.log`);
    if (fs.existsSync(logFile)) {
      console.log(`Log file exists at ${logFile}. Checking last entries:`);
      try {
        // Show the last few lines of the log file
        const lastLogs = execSync(`tail -n 20 ${logFile}`, { encoding: 'utf8' });
        console.log(lastLogs);
      } catch (err) {
        console.error('Failed to read log file:', err.message);
      }
    }
  }
} catch (error) {
  console.error('Error finding or killing process:', error.message);
}

// Verify if the node is still running
setTimeout(() => {
  try {
    const result = execSync(`curl -s http://localhost:${port}/chain`, { encoding: 'utf8' });
    console.log(`\nWARNING: Node ${nodeNumber} still appears to be running!`);
    console.log('You may need to manually kill the process.');
  } catch (e) {
    console.log(`\nVerified: Node ${nodeNumber} is no longer responding on port ${port}.`);
  }
}, 1000);
