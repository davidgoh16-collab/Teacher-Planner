import re

with open("App.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r"  const \[expandedActiveDays, setExpandedActiveDays\] = useState<Record<string, boolean>>\(\{\}\);\n  const \[expandedActiveDays, setExpandedActiveDays\] = useState<Record<string, boolean>>\(\{\}\);",
    """  const [expandedActiveDays, setExpandedActiveDays] = useState<Record<string, boolean>>({});""",
    content
)

with open("App.tsx", "w") as f:
    f.write(content)
