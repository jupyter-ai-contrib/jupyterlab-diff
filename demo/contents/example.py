"""A small example module."""


def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


def main():
    for i in range(10):
        print(fibonacci(i))
