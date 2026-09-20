const http = require('http');

function post(url, data, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('TEST 1: Super Admin Login (Direct Email + Password, No OTP)');
  console.log('====================================================');
  const superLogin = await post('http://localhost:4000/api/auth/login', {
    email: 'superadmin@schoolerp.com',
    password: 'SuperAdmin@2026',
    demoRole: 'SUPER_ADMIN'
  });
  console.log('Super Admin Login Status:', superLogin.status);
  console.log('Name:', superLogin.body?.user?.name, '| Role:', superLogin.body?.user?.role);
  const superToken = superLogin.body?.accessToken;

  console.log('\n====================================================');
  console.log('TEST 2: Super Admin Provisioning a Teacher for Greenwood High');
  console.log('====================================================');
  const teacherProvision = await post('http://localhost:4000/api/super-admin/users/setup-access', {
    name: 'Mrs. Priya Ramanathan',
    email: 'priya.ramanathan@greenwoodhigh.edu',
    phone: '9841029384',
    role: 'TEACHER',
    schoolId: 'school-greenwood-high',
    temporaryPassword: 'Teacher@2026',
  }, superToken);
  console.log('Provision Teacher Status:', teacherProvision.status);
  console.log('User created:', teacherProvision.body?.name, '| Role:', teacherProvision.body?.role);

  console.log('\n====================================================');
  console.log('TEST 3: Logging In as Mrs. Priya Ramanathan (Teacher)');
  console.log('====================================================');
  const priyaLogin = await post('http://localhost:4000/api/auth/login', {
    email: 'priya.ramanathan@greenwoodhigh.edu',
    password: 'Teacher@2026',
    demoRole: 'TEACHER'
  });
  console.log('Priya Login Status:', priyaLogin.status);
  console.log('User Name:', priyaLogin.body?.user?.name);
  console.log('Staff ID:', priyaLogin.body?.user?.staffId);
  console.log('Staff Profile Name:', priyaLogin.body?.user?.staffProfile?.name);

  console.log('\n====================================================');
  console.log('TEST 4: Super Admin Provisioning a Driver for Greenwood High');
  console.log('====================================================');
  const driverProvision = await post('http://localhost:4000/api/super-admin/users/setup-access', {
    name: 'Saravanan Logistics Driver',
    email: 'saravanan.driver@greenwoodhigh.edu',
    phone: '9884019283',
    role: 'DRIVER',
    schoolId: 'school-greenwood-high',
    temporaryPassword: 'Driver@2026',
  }, superToken);
  console.log('Provision Driver Status:', driverProvision.status);
  console.log('Driver user:', driverProvision.body?.name, '| Role:', driverProvision.body?.role);

  console.log('\n====================================================');
  console.log('TEST 5: Logging In as Saravanan Logistics Driver');
  console.log('====================================================');
  const saravananLogin = await post('http://localhost:4000/api/auth/login', {
    email: 'saravanan.driver@greenwoodhigh.edu',
    password: 'Driver@2026',
    demoRole: 'DRIVER'
  });
  console.log('Saravanan Login Status:', saravananLogin.status);
  console.log('Driver Name:', saravananLogin.body?.user?.name);
  console.log('Driver Profile License:', saravananLogin.body?.user?.driverProfile?.licenseNumber);

  console.log('\n====================================================');
  console.log('TEST 6: Principal creating a Teacher in School HR');
  console.log('====================================================');
  const principalToken = (await post('http://localhost:4000/api/auth/login', {
    email: 'admin@greenwoodhigh.edu',
    password: 'SuperAdmin@2026',
    demoRole: 'SCHOOL_ADMIN'
  })).body?.accessToken;

  const hrTeacher = await post('http://localhost:4000/api/hr/staff', {
    schoolId: 'school-greenwood-high',
    name: 'Mr. Rajesh Kumar',
    email: 'rajesh.kumar@greenwoodhigh.edu',
    phone: '9790812345',
    role: 'TEACHER',
    designation: 'Senior Physics Teacher',
    password: 'Teacher@2026',
  }, principalToken);
  console.log('Principal Created Staff Status:', hrTeacher.status);
  console.log('Created Staff Name:', hrTeacher.body?.name, '| User Account:', hrTeacher.body?.user?.email);

  console.log('\n====================================================');
  console.log('TEST 7: Logging In as Rajesh Kumar (Created by Principal)');
  console.log('====================================================');
  const rajeshLogin = await post('http://localhost:4000/api/auth/login', {
    email: 'rajesh.kumar@greenwoodhigh.edu',
    password: 'Teacher@2026',
    demoRole: 'TEACHER'
  });
  console.log('Rajesh Login Status:', rajeshLogin.status);
  console.log('Name:', rajeshLogin.body?.user?.name);
  console.log('Staff ID:', rajeshLogin.body?.user?.staffId);
  console.log('Designation:', rajeshLogin.body?.user?.staffProfile?.designation);

  console.log('\n=== ALL ROLE-BASED PROVISIONING & DATA INTEGRITY TESTS COMPLETED ===');
}

run().catch(console.error);
