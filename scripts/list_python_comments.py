import sys
import tokenize

for file_name in sys.argv[1:]:
    with open(file_name, "rb") as handle:
        for token in tokenize.tokenize(handle.readline):
            if token.type == tokenize.COMMENT:
                print(f"{token.start[0]}: {token.string[:80]}")
