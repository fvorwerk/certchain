#!/usr/bin/env node

const axios = require('axios');
const { program } = require('commander');

// Define certificate types
const CERTIFICATE_TYPES = [
  'High School Diploma',
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'PhD',
  'Professional Certification',
  'Technical Training',
  'Language Proficiency',
  'Online Course Completion'
];

// Define schools/universities
const INSTITUTIONS = [
  'University of Technology',
  'Global Institute of Science',
  'Metropolitan College',
  'National Technical University',
  'International Business School',
  'Academy of Fine Arts',
  'Central Medical University',
  'Online Learning Institute'
];

// Define locations
const LOCATIONS = [
  'New York, USA',
  'London, UK',
  'Berlin, Germany',
  'Tokyo, Japan',
  'Sydney, Australia',
  'Toronto, Canada',
  'Paris, France',
  'Singapore'
];

// Define majors/subjects
const SUBJECTS = [
  'Computer Science',
  'Electrical Engineering',
  'Business Administration',
  'Medicine',
  'Physics',
  'Mathematics',
  'Fine Arts',
  'Psychology',
  'Economics',
  'Chemistry'
];

// Define faculty names (first names and last names to mix)
const FACULTY_FIRST_NAMES = [
  'John', 'Maria', 'David', 'Sarah', 'Michael', 'Jennifer', 
  'Robert', 'Linda', 'William', 'Elizabeth', 'James', 'Susan'
];

const FACULTY_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 
  'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'
];

// Define student names (first names and last names to mix)
const STUDENT_FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 
  'James', 'Isabella', 'Oliver', 'Charlotte', 'Benjamin', 'Mia', 
  'Elijah', 'Amelia', 'Lucas', 'Harper', 'Mason', 'Evelyn'
];

const STUDENT_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 
  'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 
  'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson'
];

// Helper function to get a random item from an array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate a random date in the past (1-5 years)
function getRandomPastDate() {
  const now = new Date();
  const pastDate = new Date(
    now.getFullYear() - Math.floor(Math.random() * 5) - 1,
    Math.floor(Math.random() * 12),
    Math.floor(Math.random() * 28) + 1
  );
  return pastDate.toISOString().split('T')[0];
}

// Generate a random student
function generateStudent() {
  return {
    firstName: getRandomItem(STUDENT_FIRST_NAMES),
    lastName: getRandomItem(STUDENT_LAST_NAMES),
    studentId: `S${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
  };
}

// Generate a random faculty member
function generateFaculty() {
  return {
    firstName: getRandomItem(FACULTY_FIRST_NAMES),
    lastName: getRandomItem(FACULTY_LAST_NAMES),
    title: getRandomItem(['Professor', 'Dr.', 'Associate Professor', 'Assistant Professor', 'Lecturer'])
  };
}

// Generate a random certificate
function generateCertificate() {
  const student = generateStudent();
  const faculty = generateFaculty();
  const institution = getRandomItem(INSTITUTIONS);
  
  return {
    certificateId: `CERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: getRandomItem(CERTIFICATE_TYPES),
    issueDate: getRandomPastDate(),
    student: {
      fullName: `${student.firstName} ${student.lastName}`,
      id: student.studentId
    },
    institution: {
      name: institution,
      location: getRandomItem(LOCATIONS)
    },
    subject: getRandomItem(SUBJECTS),
    signedBy: `${faculty.title} ${faculty.firstName} ${faculty.lastName}`,
    grade: getRandomItem(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'Pass']),
    metadata: {
      verificationUrl: `https://certchain.example.com/verify/${Math.floor(Math.random() * 10000)}`,
      createdAt: new Date().toISOString()
    }
  };
}

// Set up the CLI program with options
program
  .version('1.0.0')
  .description('Generate dummy certificates and add them to the blockchain')
  .option('-n, --number <number>', 'Number of certificates to generate', '1')
  .option('-h, --host <host>', 'Blockchain node host', 'http://localhost:3001')
  .option('-m, --mine', 'Mine a new block immediately after adding certificates', false)
  .parse(process.argv);

// Get the options
const options = program.opts();

// Main function to generate and send certificates
async function main() {
  const numCertificates = parseInt(options.number);
  const host = options.host;
  const mine = options.mine;

  console.log(`Generating ${numCertificates} certificate(s) and sending to ${host}...`);

  for (let i = 0; i < numCertificates; i++) {
    const certificate = generateCertificate();
    
    console.log(`\nCertificate ${i+1}/${numCertificates}:`);
    console.log(`- ID: ${certificate.certificateId}`);
    console.log(`- Type: ${certificate.type}`);
    console.log(`- Student: ${certificate.student.fullName}`);
    console.log(`- Institution: ${certificate.institution.name}`);
    console.log(`- Subject: ${certificate.subject}`);
    
    try {
      const response = await axios.post(`${host}/certificates`, { certificate });
      console.log(`- Status: Added successfully (future block index: ${response.data.blockIndex})`);
    } catch (error) {
      console.error(`- Error adding certificate: ${error.message}`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  // If mining option is set, trigger block creation
  if (mine) {
    console.log('\nMining a new block...');
    try {
      const response = await axios.post(`${host}/mine`);
      console.log(`Block created successfully: Index ${response.data.block.index}`);
    } catch (error) {
      console.error(`Error mining block: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

main().catch(error => {
  console.error('An unexpected error occurred:', error.message);
  process.exit(1);
});
