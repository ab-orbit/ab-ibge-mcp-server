#!/usr/bin/env python3
"""Teste rápido do agente IBGE com Ollama"""

import subprocess
import time

# Simular entrada do usuário
# NOTA: Ajuste os números conforme os providers disponíveis no seu sistema
# Se tiver ANTHROPIC/OPENAI configurados, LOCALHOST será 3
# Se só tiver LOCALHOST, será 1
inputs = [
    "3",  # Escolher LOCALHOST (ou "1" se for o único provider)
    "1",  # Escolher primeiro modelo disponível
    "quantas pessoas se chamam maria?",  # Pergunta
    "sair"  # Sair
]

print("🚀 Testando Agente IBGE com Ollama...")
print("=" * 60)

# Criar processo
proc = subprocess.Popen(
    ["python3", "agente_ibge_v3.py"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Enviar inputs
input_text = "\n".join(inputs) + "\n"
try:
    stdout, stderr = proc.communicate(input=input_text, timeout=120)

    print("=== STDOUT ===")
    print(stdout)

    if stderr:
        print("\n=== STDERR ===")
        print(stderr)

    print(f"\n=== Exit code: {proc.returncode} ===")

    # Verificar sucesso
    if "Forçando resposta" in stdout and "🤖 Agente:" in stdout:
        print("\n✅ TESTE PASSOU! Agente funcionou corretamente.")
    else:
        print("\n⚠️  Verifique a saída acima.")

except subprocess.TimeoutExpired:
    proc.kill()
    print("\n❌ TIMEOUT! Agente demorou mais de 120s.")
except Exception as e:
    print(f"\n❌ ERRO: {e}")