with open("/home/jules/verification/verify.py", "r") as f:
    content = f.read()

content = content.replace('page.click(\'button:has-text("Add Category")\')', 'page.click(\'button:has-text("Add Category")\', force=True)')

with open("/home/jules/verification/verify.py", "w") as f:
    f.write(content)
