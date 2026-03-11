import { describe, it, expect } from "vitest";
import { IBGE_API, ibgeFetch } from "../../src/services/ibge-client.js";
import {
  expectValidToolResponse,
  expectNoError,
  expectHasData,
  expectContains,
  TEST_CODES,
  delay,
} from "../helpers/test-utils.js";

describe("Localidades Tools", () => {
  describe("ibge_listar_regioes", () => {
    it("deve retornar as 5 regiões geográficas do Brasil", async () => {
      interface Regiao {
        id: number;
        sigla: string;
        nome: string;
      }
      const regioes = await ibgeFetch<Regiao[]>(`${IBGE_API.v1}/localidades/regioes`);

      expect(regioes).toBeDefined();
      expect(regioes).toHaveLength(5);

      // Verifica estrutura de cada região
      regioes.forEach((regiao) => {
        expect(regiao).toHaveProperty("id");
        expect(regiao).toHaveProperty("sigla");
        expect(regiao).toHaveProperty("nome");
      });

      // Verifica se contém as principais regiões
      const siglas = regioes.map((r) => r.sigla);
      expect(siglas).toContain("N"); // Norte
      expect(siglas).toContain("NE"); // Nordeste
      expect(siglas).toContain("SE"); // Sudeste
      expect(siglas).toContain("S"); // Sul
      expect(siglas).toContain("CO"); // Centro-Oeste
    });
  });

  describe("ibge_listar_estados", () => {
    it("deve retornar todos os 27 estados", async () => {
      interface Estado {
        id: number;
        sigla: string;
        nome: string;
        regiao: { id: number; sigla: string; nome: string };
      }
      const estados = await ibgeFetch<Estado[]>(`${IBGE_API.v1}/localidades/estados`);

      expect(estados).toBeDefined();
      expect(estados).toHaveLength(27);

      // Verifica estrutura
      estados.forEach((estado) => {
        expect(estado).toHaveProperty("id");
        expect(estado).toHaveProperty("sigla");
        expect(estado).toHaveProperty("nome");
        expect(estado).toHaveProperty("regiao");
      });

      // Verifica alguns estados conhecidos
      const siglas = estados.map((e) => e.sigla);
      expect(siglas).toContain("SP");
      expect(siglas).toContain("RJ");
      expect(siglas).toContain("MG");
      expect(siglas).toContain("BA");
      expect(siglas).toContain("DF");
    });
  });

  describe("ibge_listar_municipios", () => {
    it("deve retornar municípios de São Paulo", async () => {
      interface Municipio {
        id: number;
        nome: string;
        microrregiao: any;
        "regiao-imediata": any;
      }
      const municipios = await ibgeFetch<Municipio[]>(
        `${IBGE_API.v1}/localidades/estados/${TEST_CODES.SP}/municipios`
      );

      expect(municipios).toBeDefined();
      expect(municipios.length).toBeGreaterThan(600); // SP tem 645 municípios

      // Verifica estrutura
      municipios.slice(0, 5).forEach((mun) => {
        expect(mun).toHaveProperty("id");
        expect(mun).toHaveProperty("nome");
      });

      // Verifica se encontra a capital
      const nomes = municipios.map((m) => m.nome);
      expect(nomes).toContain("São Paulo");
    });

    it("deve buscar municípios com nome parcial", async () => {
      interface Municipio {
        id: number;
        nome: string;
      }
      const municipios = await ibgeFetch<Municipio[]>(
        `${IBGE_API.v1}/localidades/estados/${TEST_CODES.SP}/municipios`
      );

      // Filtra municípios que começam com "São"
      const saoMunicipios = municipios.filter((m) => m.nome.startsWith("São"));
      expect(saoMunicipios.length).toBeGreaterThan(20); // SP tem muitos municípios "São X"
    });
  });

  describe("ibge_buscar_municipio", () => {
    it("deve encontrar São Paulo por ID", async () => {
      interface Municipio {
        id: number;
        nome: string;
        microrregiao: any;
      }
      const municipio = await ibgeFetch<Municipio>(
        `${IBGE_API.v1}/localidades/municipios/${TEST_CODES.SAO_PAULO}`
      );

      expect(municipio).toBeDefined();
      expect(municipio.nome).toBe("São Paulo");
      expect(municipio.id).toBe(Number(TEST_CODES.SAO_PAULO));
    });

    it("deve encontrar Rio de Janeiro por ID", async () => {
      interface Municipio {
        id: number;
        nome: string;
      }
      const municipio = await ibgeFetch<Municipio>(
        `${IBGE_API.v1}/localidades/municipios/${TEST_CODES.RIO_JANEIRO}`
      );

      expect(municipio).toBeDefined();
      expect(municipio.nome).toBe("Rio de Janeiro");
    });

    it("deve encontrar Brasília por ID", async () => {
      interface Municipio {
        id: number;
        nome: string;
      }
      const municipio = await ibgeFetch<Municipio>(
        `${IBGE_API.v1}/localidades/municipios/${TEST_CODES.BRASILIA}`
      );

      expect(municipio).toBeDefined();
      expect(municipio.nome).toBe("Brasília");
    });
  });

  describe("Busca sem acentos", () => {
    it("deve normalizar e encontrar municípios sem acento", async () => {
      // Testa normalização de string (função de busca)
      const normalize = (str: string) =>
        str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      expect(normalize("São Paulo")).toBe("sao paulo");
      expect(normalize("Florianópolis")).toBe("florianopolis");
      expect(normalize("Brasília")).toBe("brasilia");
    });
  });
});
