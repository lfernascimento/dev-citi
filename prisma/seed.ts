import { Luminosidade, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plantasDeExemplo = [
  { nome: "Costela-de-adão", especie: "Monstera deliciosa", preco: 8990, estoque: 12, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: false, regaACadaDias: 3 },
  { nome: "Samambaia", especie: "Nephrolepis exaltata", preco: 4500, estoque: 8, luminosidade: Luminosidade.SOMBRA, petFriendly: true, regaACadaDias: 2 },
  { nome: "Cacto-bola", especie: "Echinopsis calochlora", preco: 2500, estoque: 20, luminosidade: Luminosidade.SOL_PLENO, petFriendly: false, regaACadaDias: 14 },
  { nome: "Jiboia", especie: "Epipremnum aureum", preco: 3990, estoque: 15, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: false, regaACadaDias: 5 },
  { nome: "Violeta", especie: "Streptocarpus ionanthus", preco: 3200, estoque: 6, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: true, regaACadaDias: 4 },
  { nome: "Palmeira-areca", especie: "Dypsis lutescens", preco: 12900, estoque: 4, luminosidade: Luminosidade.SOL_PLENO, petFriendly: true, regaACadaDias: 3 },
  { nome: "Espada-de-são-jorge", especie: "Dracaena trifasciata", preco: 5500, estoque: 0, luminosidade: Luminosidade.SOMBRA, petFriendly: false, regaACadaDias: 10 },
  { nome: "Orquídea-phalaenopsis", especie: "Phalaenopsis amabilis", preco: 7900, estoque: 0, luminosidade: Luminosidade.MEIA_SOMBRA, petFriendly: true, regaACadaDias: 7 },
];

const main = async () => {
  // Não duplica nem apaga nada: só popula uma tabela vazia
  const totalDePlantas = await prisma.planta.count();

  if (totalDePlantas > 0) {
    console.log(`Já existem ${totalDePlantas} plantas no banco. Seed ignorado.`);
    return;
  }

  const { count } = await prisma.planta.createMany({ data: plantasDeExemplo });

  console.log(`${count} plantas de exemplo cadastradas.`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
