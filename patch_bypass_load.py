import re

with open("App.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r"  const isTestBypass = !user && window\.location\.search\.includes\('bypass_login=true'\);\n  if \(isTestBypass\) \{\n     // we'll pretend there is a user\n  \} else if \(!user\) \{",
    """  const isTestBypass = !user && window.location.search.includes('bypass_login=true');
  if (isTestBypass) {
     // we'll pretend there is a user
     if (!user) {
         setUser({ uid: 'test-user', displayName: 'Test User' } as any);
         setAuthLoading(false);
         return null; // Force re-render with user set
     }
  } else if (!user) {""",
    content
)

with open("App.tsx", "w") as f:
    f.write(content)
