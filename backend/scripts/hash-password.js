import bcrypt from 'bcrypt';

const password = process.argv[2];
const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

if (!password) {
  console.error('Usage: node scripts/hash-password.js your_password');
  process.exit(1);
}

bcrypt.hash(password, rounds).then(hash => {
  console.log(hash);
}).catch(err => {
  console.error('Error hashing password:', err);
  process.exit(1);
});
