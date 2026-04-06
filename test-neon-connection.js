const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔍 Testando conexão com Neon...');
    console.log(`📍 Database URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);

    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão bem-sucedida!');
    console.log('📊 Testando tabelas existentes...');

    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log(`✅ ${tables.length} tabelas encontradas:`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));

  } catch (error) {
    console.error('❌ Erro ao conectar:');
    console.error(`   Tipo: ${error.code || error.message}`);
    console.error(`   Mensagem: ${error.message}`);

    if (error.message.includes('Can\'t reach')) {
      console.error('\n💡 Sugestões:');
      console.error('   1. Verifique se o banco Neon está ativo em https://console.neon.tech');
      console.error('   2. Verifique a senha da DATABASE_URL em .env');
      console.error('   3. Tente reiniciar o banco Neon no console');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
