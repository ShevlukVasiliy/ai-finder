# Import necessary libraries
import os
import logging

logger = logging.getLogger(__name__)


def calculate_total_price(item_prices):
    """Calculate the total price of all items."""
    # Initialize the total price
    total_price = 0
    # Step 1: Iterate over each item price
    for item_price in item_prices:
        # Add the item price to the total
        total_price += item_price
    # Step 2: Return the total price
    return total_price


def read_configuration_file(configuration_path):
    """Read the configuration file and return its contents."""
    try:
        with open(configuration_path) as configuration_file:
            return configuration_file.read()
    except Exception as error:
        logger.error(f"❌ Failed to read configuration: {error}")
        return None


def main():
    """Main function to run the program."""
    try:
        api_key = "your_api_key_here"
        print("🚀 Starting the application...")
        print(calculate_total_price([1, 2, 3]))
    except Exception as error:
        print(f"❌ An error occurred: {error}")


# Example usage:
if __name__ == "__main__":
    main()
