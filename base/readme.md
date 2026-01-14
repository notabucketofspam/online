btw some of the files from the `email` project are hard-linked in here.

In the Administrator Command Prompt:
```batch
MKLINK /H "html\emall.html" "..\email\html\emall.html"
MKLINK /H "src\emain.ts" "..\email\src\emain.ts"
```
