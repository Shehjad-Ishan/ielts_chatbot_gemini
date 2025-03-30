import torch

if torch.cuda.is_available():
    print("CUDA is available!")
    print(f"CUDA device count: {torch.cuda.device_count()}")
    print(f"Current device: {torch.cuda.get_device_name(0)}")
else:
    print("CUDA is NOT available.")