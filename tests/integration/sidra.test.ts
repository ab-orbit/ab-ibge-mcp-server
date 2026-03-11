import { describe, it, expect } from "vitest";
import { IBGE_API, ibgeFetch } from "../../src/services/ibge-client.js";
import type { SidraResultado } from "../../src/types.js";
import {
  expectValidSidraResponse,
  TEST_CODES,
  TEST_YEARS,
  delay,
} from "../helpers/test-utils.js";

describe("SIDRA Tools", () => {
  describe("ibge_sidra_pesquisar_tabelas", () => {
    it("deve retornar lista de agregados", async () => {
      interface Agregado {
        id: string;
        nome: string;
        pesquisaID?: string;
      }
      const agregados = await ibgeFetch<Agregado[]>(`${IBGE_API.v3}/agregados`);

      expect(agregados).toBeDefined();
      expect(Array.isArray(agregados)).toBe(true);
      expect(agregados.length).toBeGreaterThan(50); // Ajustado para valor real

      // Verifica estrutura básica
      const primeiroAgregado = agregados[0];
      expect(primeiroAgregado).toHaveProperty("id");
      expect(primeiroAgregado).toHaveProperty("nome");
    });

    it("deve buscar tabelas por pesquisa Censo (CN)", async () => {
      interface PesquisaGrupo {
        id: string;
        nome: string;
        agregados: Array<{ id: string; nome: string }>;
      }
      const grupos = await ibgeFetch<PesquisaGrupo[]>(
        `${IBGE_API.v3}/agregados?pesquisa=CN`
      );

      expect(grupos).toBeDefined();
      expect(Array.isArray(grupos)).toBe(true);

      // Censo deve ter tabelas
      const agregadosCenso = grupos.flatMap((g) => g.agregados ?? []);
      expect(agregadosCenso.length).toBeGreaterThan(0);
    });
  });

  describe("ibge_sidra_metadados_tabela", () => {
    it("deve retornar metadados da tabela 1419 (IPCA)", async () => {
      interface Meta {
        id: string;
        nome: string;
        variaveis: Array<{ id: string; nome: string; unidade: string }>;
        periodicidade: { frequencia: string; inicio: string; fim: string };
      }
      const meta = await ibgeFetch<Meta>(
        `${IBGE_API.v3}/agregados/1419/metadados`
      );

      expect(meta).toBeDefined();
      expect(meta.id).toBe(1419); // API retorna número
      expect(meta.nome).toContain("IPCA");

      // Verifica variáveis conhecidas
      const variaveis = meta.variaveis;
      expect(variaveis.length).toBeGreaterThan(0);

      const varIds = variaveis.map((v) => v.id);
      expect(varIds).toContain(63); // Variação mensal (número)
      expect(varIds).toContain(69); // Variação acumulada ano (número)
      expect(varIds).toContain(2265); // Variação acumulada 12 meses (corrigido!)
    });

    it("deve retornar metadados da tabela 9514 (Censo 2022 população)", async () => {
      interface Meta {
        id: string;
        nome: string;
        variaveis: Array<{ id: string; nome: string }>;
      }
      const meta = await ibgeFetch<Meta>(
        `${IBGE_API.v3}/agregados/9514/metadados`
      );

      expect(meta).toBeDefined();
      expect(meta.id).toBe(9514); // API retorna número
      expect(meta.nome).toContain("População");

      // Variável 93 = População residente
      const varIds = meta.variaveis.map((v) => v.id);
      expect(varIds).toContain(93); // Número, não string
    });
  });

  describe("ibge_periodos_tabela", () => {
    it("deve retornar períodos disponíveis da tabela IPCA (1419)", async () => {
      interface Periodo {
        id: string;
        literals: string[];
      }
      const periodos = await ibgeFetch<Periodo[]>(
        `${IBGE_API.v3}/agregados/1419/periodos`
      );

      expect(periodos).toBeDefined();
      expect(Array.isArray(periodos)).toBe(true);
      expect(periodos.length).toBeGreaterThan(90); // IPCA tem dados desde 1979 (ajustado)

      // Verifica formato de período (AAAAMM)
      const primeiroId = periodos[0].id;
      expect(primeiroId).toMatch(/^\d{6}$/); // 6 dígitos: AAAAMM
    });
  });

  describe("ibge_sidra_consultar_tabela", () => {
    it("deve consultar população do Brasil - Censo 2022", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=N1[all]`
      );

      expect(dados).toBeDefined();
      expect(Array.isArray(dados)).toBe(true);
      expect(dados.length).toBeGreaterThan(0);

      // Verifica estrutura SIDRA
      const resultado = dados[0];
      expect(resultado).toHaveProperty("variavel");
      expect(resultado).toHaveProperty("unidade");
      expect(resultado).toHaveProperty("resultados");

      // Verifica se tem dados do Brasil
      const series = resultado.resultados[0].series;
      expect(series.length).toBeGreaterThan(0);
      expect(series[0].localidade.nome).toContain("Brasil");
    });

    it("deve consultar PIB de São Paulo (tabela 5938)", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/5938/periodos/${TEST_YEARS.PIB_RECENTE}/variaveis/37?localidades=N6[${TEST_CODES.SAO_PAULO}]`
      );

      expect(dados).toBeDefined();
      expect(dados[0].variavel).toContain("Produto Interno Bruto"); // Nome completo

      const serie = dados[0].resultados[0].series[0];
      expect(serie.localidade.nome).toContain("São Paulo"); // Pode vir "São Paulo (SP)"
      expect(Object.keys(serie.serie).length).toBeGreaterThan(0);
    });

    it("deve consultar múltiplas variáveis simultaneamente", async () => {
      await delay(500);
      // Consulta variáveis 63 (mensal) e 69 (acumulada ano) do IPCA
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/1419/periodos/last%206/variaveis/63|69?localidades=N1[all]`
      );

      expect(dados).toBeDefined();
      expect(dados.length).toBe(2); // Duas variáveis retornadas

      const variaveis = dados.map((d) => d.variavel);
      expect(variaveis).toContain("IPCA - Variação mensal");
      expect(variaveis).toContain("IPCA - Variação acumulada no ano");
    });
  });

  describe("ibge_ipca - Teste da correção do bug", () => {
    it("deve consultar IPCA variação mensal (variável 63)", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/1419/periodos/last%2012/variaveis/63?localidades=N1[all]`
      );

      expect(dados).toBeDefined();
      expect(dados[0].variavel).toContain("Variação mensal");

      const serie = dados[0].resultados[0].series[0].serie;
      expect(Object.keys(serie).length).toBe(12); // 12 meses
    });

    it("deve consultar IPCA acumulado no ano (variável 69)", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/1419/periodos/last%2012/variaveis/69?localidades=N1[all]`
      );

      expect(dados).toBeDefined();
      expect(dados[0].variavel).toContain("acumulada no ano");
    });

    it("🐛 FIX: deve consultar IPCA acumulado 12 meses (variável 2265) - CORRIGIDO", async () => {
      await delay(500);
      // Este é o bug que foi corrigido: variável 2265 (não 2266)
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/1419/periodos/last%2012/variaveis/2265?localidades=N1[all]`
      );

      expect(dados).toBeDefined();
      expect(dados[0].variavel).toBe("IPCA - Variação acumulada em 12 meses");

      const serie = dados[0].resultados[0].series[0].serie;
      expect(Object.keys(serie).length).toBe(12);

      // Verifica que os valores são numéricos e razoáveis
      const valores = Object.values(serie).map((v) => parseFloat(v as string));
      valores.forEach((valor) => {
        expect(valor).toBeGreaterThan(-10); // Inflação > -10%
        expect(valor).toBeLessThan(50); // Inflação < 50% (valores razoáveis)
      });
    });

    it("❌ deve falhar com variável incorreta 2266 (bug antigo)", async () => {
      await delay(500);
      // Verifica que a variável antiga (2266) realmente não existe
      await expect(
        ibgeFetch<SidraResultado[]>(
          `${IBGE_API.v3}/agregados/1419/periodos/last%2012/variaveis/2266?localidades=N1[all]`
        )
      ).rejects.toThrow();
    });
  });

  describe("ibge_pib_municipios", () => {
    it("deve retornar PIB de São Paulo", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/5938/periodos/${TEST_YEARS.PIB_RECENTE}/variaveis/37|497?localidades=N6[${TEST_CODES.SAO_PAULO}]`
      );

      expect(dados).toBeDefined();
      expect(dados.length).toBe(2); // PIB total e per capita

      // Verifica que tem PIB total e per capita
      const variaveis = dados.map((d) => d.variavel);
      expect(variaveis).toContain("Produto Interno Bruto a preços correntes");
    });
  });

  describe("ibge_pib_estados", () => {
    it("deve retornar PIB de todos os estados", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/5938/periodos/${TEST_YEARS.PIB_RECENTE}/variaveis/37?localidades=N3[all]`
      );

      expect(dados).toBeDefined();
      const series = dados[0].resultados[0].series;
      expect(series.length).toBe(27); // 27 estados + DF

      // Verifica alguns estados conhecidos
      const nomes = series.map((s) => s.localidade.nome);
      expect(nomes).toContain("São Paulo");
      expect(nomes).toContain("Rio de Janeiro");
      expect(nomes).toContain("Minas Gerais");
    });
  });

  describe("ibge_populacao_censo2022", () => {
    it("deve retornar população do Brasil", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=N1[all]`
      );

      expect(dados).toBeDefined();
      const serie = dados[0].resultados[0].series[0];
      expect(serie.localidade.nome).toContain("Brasil");

      const populacao = parseInt(Object.values(serie.serie)[0] as string);
      expect(populacao).toBeGreaterThan(200_000_000); // Brasil tem 200M+ habitantes
      expect(populacao).toBeLessThan(250_000_000);
    });

    it("deve retornar população dos estados", async () => {
      await delay(500);
      const dados = await ibgeFetch<SidraResultado[]>(
        `${IBGE_API.v3}/agregados/9514/periodos/2022/variaveis/93?localidades=N3[all]`
      );

      expect(dados).toBeDefined();
      const series = dados[0].resultados[0].series;
      expect(series.length).toBe(27);

      // São Paulo é o estado mais populoso
      const sp = series.find((s) => s.localidade.nome === "São Paulo");
      expect(sp).toBeDefined();
      const popSP = parseInt(Object.values(sp!.serie)[0] as string);
      expect(popSP).toBeGreaterThan(40_000_000);
    });
  });
});
