import os
import re


def run(project_id: int, folder: str):
    metadatos_path = os.path.join(folder, "metadatos.txt")
    if not os.path.exists(metadatos_path):
        return

    with open(metadatos_path, "r", encoding="utf-8") as f:
        content = f.read()

    prompt = _extract_prompt(content)
    if not prompt:
        return

    out_path = os.path.join(folder, "prompt_miniatura.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(prompt)


def _extract_prompt(content: str) -> str:
    match = re.search(
        r'MINIATURA.*?PROMPT\s*={3,}\s*\n(.*?)(?:={3,}|$)',
        content, re.DOTALL | re.IGNORECASE
    )
    if match:
        return match.group(1).strip()
    return ""
