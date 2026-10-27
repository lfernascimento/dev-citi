import { Luminosidade, Prisma } from "@prisma/client";
import prisma from "@database";

export type FiltrosPlanta = {
    luminosidade?: Luminosidade;
    petFriendly?: boolean;
    nome?: string;
    ordem?: "preco" | "nome";
};

export const createPlanta = async (data: Prisma.PlantaCreateInput) => {
    return await prisma.planta.create({
        data: data,
    });
};

// Condições com valor undefined são ignoradas pelo Prisma:
// uma única consulta resolve qualquer combinação de filtros.
export const findAllPlantas = async (filtros: FiltrosPlanta) => {
    const { luminosidade, petFriendly, nome, ordem } = filtros;

    const ordenacao: Prisma.PlantaOrderByWithRelationInput =
        ordem === "preco" ? { preco: "asc" } :
        ordem === "nome" ? { nome: "asc" } :
        { id: "asc" };

    return await prisma.planta.findMany({
        where: {
            luminosidade: luminosidade,
            petFriendly: petFriendly,
            nome: nome === undefined ? undefined : { contains: nome, mode: "insensitive" },
        },
        orderBy: ordenacao,
    });
};

export const findPlantasEsgotadas = async () => {
    return await prisma.planta.findMany({
        where: { estoque: 0 },
        orderBy: { id: "asc" },
    });
};

export const findPlantaById = async (id: number) => {
    return await prisma.planta.findUnique({
        where: { id: id }
    });
};

export const updatePlanta = async (id: number, data: Prisma.PlantaUpdateInput) => {
    return await prisma.planta.update({
        where: { id: id },
        data: data,
    });
};

export const deletePlanta = async (id: number) => {
    return await prisma.planta.delete({
        where: { id: id }
    });
};

// A checagem "estoque >= quantidade" e a subtração acontecem na MESMA instrução SQL.
// Se duas vendas disputam o último vaso, o banco executa uma de cada vez:
// a segunda não encontra estoque suficiente e devolve count = 0, sem alterar nada.
export const decrementarEstoque = async (id: number, quantidade: number) => {
    return await prisma.planta.updateMany({
        where: { id: id, estoque: { gte: quantidade } },
        data: { estoque: { decrement: quantidade } },
    });
};

export const findPrecoEEstoqueDeTodas = async () => {
    return await prisma.planta.findMany({
        select: { preco: true, estoque: true },
    });
};
