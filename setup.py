# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

try:
    long_description = open("README.md").read()
except IOError:
    long_description = ""

setup(
    name="kak-web-ui",
    version="0.1.0",
    description="Run the kakoune text editor in your browser",
    license="MIT",
    author="Dan Rosén",
    packages=['.'],
    entry_points={
        'console_scripts': [
            'kak-web-ui = kak_web_ui:main',
        ]
    },
    py_modules=["kak_web_ui"],
    package_data={
        '.': ["*.js"],
    },
    install_requires=[],
    long_description=long_description,
    classifiers=[
        "Programming Language :: Python",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.7",
    ]
)
