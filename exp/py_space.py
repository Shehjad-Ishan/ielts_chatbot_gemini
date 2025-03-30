import os
import sys

site_packages = next(p for p in sys.path if 'site-packages' in p or 'dist-packages' in p)

total_size = 0
for package in os.listdir(site_packages):
    package_path = os.path.join(site_packages, package)
    if os.path.isdir(package_path):
        total_size += sum(os.path.getsize(os.path.join(dirpath, f)) for dirpath, _, files in os.walk(package_path) for f in files)

print(f"Total size of installed packages: {total_size / (1024*1024):.2f} MB")