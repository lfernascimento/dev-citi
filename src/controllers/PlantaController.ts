import { Request, Response } from "express";
import { Luminosidade } from "@prisma/client";
import * as PlantaRepository from "@repositories/PlantaRepository";

// Maior valor que cabe numa coluna INTEGER do PostgreSQL.
// Acima disso o Prisma lança erro e a API responderia 500 por culpa do cliente.
const LIMITE_INT = 2147483647;

type DadosPlanta = {
  nome?: string;
  especie?: string;
  preco?: number;
  estoque?: number;
  luminosidade?: Luminosidade;
  petFriendly?: boolean;
  regaACadaDias?: number;
};

type ResultadoValidacao = { erro: string } | { dados: DadosPlanta };

const ehTextoNaoVazio = (valor: unknown): valor is string => {
  return typeof valor === "string" && valor.trim() !== "";
};

const ehInteiroEntre = (valor: unknown, minimo: number): valor is number => {
  return Number.isInteger(valor) && (valor as number) >= minimo && (valor as number) <= LIMITE_INT;
};

// O :id chega da URL como texto. A regex recusa "abc", "1.5", "-1" e "1e3".
const lerId = (valor: string): number | null => {
  if (!/^\d+$/.test(valor)) return null;

  const id = Number(valor);

  return id > 0 && id <= LIMITE_INT ? id : null;
};

// Valida só os campos enviados (!== undefined).
// No cadastro (todosObrigatorios = true) todos precisam vir; na edição, nenhum.
const validarCamposDaPlanta = (corpo: any, todosObrigatorios: boolean): ResultadoValidacao => {
  const { nome, especie, preco, estoque, luminosidade, petFriendly, regaACadaDias } = corpo ?? {};

  if (todosObrigatorios) {
    const campos = { nome, especie, preco, estoque, luminosidade, petFriendly, regaACadaDias };
    const faltando = Object.entries(campos)
      .filter(([, valor]) => valor === undefined)
      .map(([campo]) => campo);

    if (faltando.length > 0) {
      return { erro: `Campos obrigatórios não enviados: ${faltando.join(", ")}.` };
    }
  }

  if (nome !== undefined && !ehTextoNaoVazio(nome)) {
    return { erro: "nome deve ser um texto não vazio." };
  }

  if (especie !== undefined && !ehTextoNaoVazio(especie)) {
    return { erro: "especie deve ser um texto não vazio." };
  }

  if (preco !== undefined && !ehInteiroEntre(preco, 1)) {
    return { erro: `preco deve ser um número inteiro de centavos, entre 1 e ${LIMITE_INT}.` };
  }

  if (estoque !== undefined && !ehInteiroEntre(estoque, 0)) {
    return { erro: `estoque deve ser um número inteiro entre 0 e ${LIMITE_INT}.` };
  }

  if (luminosidade !== undefined && !Object.values(Luminosidade).includes(luminosidade)) {
    return { erro: `luminosidade deve ser um destes valores: ${Object.values(Luminosidade).join(", ")}.` };
  }

  if (petFriendly !== undefined && typeof petFriendly !== "boolean") {
    return { erro: "petFriendly deve ser true ou false." };
  }

  if (regaACadaDias !== undefined && !ehInteiroEntre(regaACadaDias, 1)) {
    return { erro: `regaACadaDias deve ser um número inteiro entre 1 e ${LIMITE_INT}.` };
  }

  // Só os campos da planta seguem adiante: nunca passamos req.body direto para o banco.
  return {
    dados: {
      nome: nome?.trim(),
      especie: especie?.trim(),
      preco: preco,
      estoque: estoque,
      luminosidade: luminosidade,
      petFriendly: petFriendly,
      regaACadaDias: regaACadaDias,
    },
  };
};

export const createPlanta = async (req: Request, res: Response) => {
  try {
    const validacao = validarCamposDaPlanta(req.body, true);

    if ("erro" in validacao) {
      return res.status(400).json({ message: validacao.erro });
    }

    const { nome, especie, preco, estoque, luminosidade, petFriendly, regaACadaDias } = validacao.dados;

    const planta = await PlantaRepository.createPlanta({
      nome: nome!,
      especie: especie!,
      preco: preco!,
      estoque: estoque!,
      luminosidade: luminosidade!,
      petFriendly: petFriendly!,
      regaACadaDias: regaACadaDias!,
    });

    return res.status(201).json(planta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao cadastrar planta." });
  }
};

export const readAllPlantas = async (req: Request, res: Response) => {
  try {
    // Filtros chegam em req.query e são sempre texto (ou lista, se repetidos na URL)
    const { luminosidade, petFriendly, nome, ordem } = req.query;

    const filtros: PlantaRepository.FiltrosPlanta = {};

    if (luminosidade !== undefined) {
      if (typeof luminosidade !== "string" || !Object.values(Luminosidade).includes(luminosidade as Luminosidade)) {
        return res.status(400).json({
          message: `luminosidade deve ser um destes valores: ${Object.values(Luminosidade).join(", ")}.`,
        });
      }
      filtros.luminosidade = luminosidade as Luminosidade;
    }

    // Um filtro não enviado continua undefined: nunca vira false
    if (petFriendly !== undefined) {
      if (petFriendly !== "true" && petFriendly !== "false") {
        return res.status(400).json({ message: "petFriendly deve ser true ou false." });
      }
      filtros.petFriendly = petFriendly === "true";
    }

    if (nome !== undefined) {
      if (typeof nome !== "string") {
        return res.status(400).json({ message: "nome deve ser um texto." });
      }
      filtros.nome = nome.trim();
    }

    if (ordem !== undefined) {
      if (ordem !== "preco" && ordem !== "nome") {
        return res.status(400).json({ message: "ordem deve ser preco ou nome." });
      }
      filtros.ordem = ordem;
    }

    // Filtro válido sem resultado é 200 com [], nunca 404
    const plantas = await PlantaRepository.findAllPlantas(filtros);

    return res.status(200).json(plantas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar plantas." });
  }
};

export const readPlantasEsgotadas = async (req: Request, res: Response) => {
  try {
    const plantas = await PlantaRepository.findPlantasEsgotadas();

    return res.status(200).json(plantas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar plantas esgotadas." });
  }
};

export const readPlantaById = async (req: Request, res: Response) => {
  try {
    const id = lerId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "O id deve ser um número inteiro maior que zero." });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    return res.status(200).json(planta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar planta." });
  }
};

export const updatePlanta = async (req: Request, res: Response) => {
  try {
    const id = lerId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "O id deve ser um número inteiro maior que zero." });
    }

    const validacao = validarCamposDaPlanta(req.body, false);

    if ("erro" in validacao) {
      return res.status(400).json({ message: validacao.erro });
    }

    // Antes de editar, garantimos que a planta existe (senão o erro do Prisma viraria um 500)
    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    // Campos undefined não são alterados pelo Prisma
    const plantaAtualizada = await PlantaRepository.updatePlanta(id, validacao.dados);

    return res.status(200).json(plantaAtualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao atualizar planta." });
  }
};

export const venderPlanta = async (req: Request, res: Response) => {
  try {
    const id = lerId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "O id deve ser um número inteiro maior que zero." });
    }

    const quantidade = req.body?.quantidade;

    if (!ehInteiroEntre(quantidade, 1)) {
      return res.status(400).json({ message: "quantidade deve ser um número inteiro maior que zero." });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    if (planta.estoque < quantidade) {
      return res.status(400).json({
        message: `Estoque insuficiente: temos só ${planta.estoque} vasos e o pedido é de ${quantidade}.`,
      });
    }

    // A conferência acima dá a mensagem clara, mas outra venda pode acontecer entre ela e a
    // gravação. Por isso o repository confere o estoque de novo na própria instrução de update.
    const { count } = await PlantaRepository.decrementarEstoque(id, quantidade);

    if (count === 0) {
      return res.status(400).json({
        message: "Estoque insuficiente: outra venda levou os vasos antes desta.",
      });
    }

    const plantaAtualizada = await PlantaRepository.findPlantaById(id);

    return res.status(200).json(plantaAtualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao registrar venda." });
  }
};

export const readValorTotalDoEstoque = async (req: Request, res: Response) => {
  try {
    const plantas = await PlantaRepository.findPrecoEEstoqueDeTodas();

    // Inteiros em centavos: a conta é sempre exata
    const valorTotalEmCentavos = plantas.reduce((total, planta) => total + planta.preco * planta.estoque, 0);
    const totalDeVasos = plantas.reduce((total, planta) => total + planta.estoque, 0);

    return res.status(200).json({ valorTotalEmCentavos, totalDeVasos });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao calcular o valor do estoque." });
  }
};

export const deletePlanta = async (req: Request, res: Response) => {
  try {
    const id = lerId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "O id deve ser um número inteiro maior que zero." });
    }

    const planta = await PlantaRepository.findPlantaById(id);

    if (!planta) {
      return res.status(404).json({ message: "Planta não encontrada." });
    }

    await PlantaRepository.deletePlanta(id);

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao deletar planta." });
  }
};
