#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running lint check...');
try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ Lint check passed');
} catch (error) {
  console.error('❌ Lint check failed');
  process.exit(1);
}

console.log('\nRunning build check...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build check passed');
} catch (error) {
  console.error('❌ Build check failed');
  process.exit(1);
}

console.log('\n🎉 All checks passed successfully!');
