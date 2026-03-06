#!/usr/bin/env python3
"""
Generate realistic Australian bank statements for testing N3xFin.
Creates PDF and CSV statements from 2 different fictional banks for 6 months.

NOTE: Uses generic bank names and merchants to avoid trademark issues.
All data is completely fictional for testing purposes only.
"""

import csv
import random
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors

# Generic merchants and categories (avoiding real brand names)
MERCHANTS = {
    'Groceries': ['SuperMart', 'FreshGrocer', 'Local Market', 'Budget Foods', 'Organic Market'],
    'Dining': ['City Cafe', 'Quick Bites', 'Pizza Place', 'Sandwich Shop', 'Coffee Corner', 'Burger Joint'],
    'Transportation': ['Public Transport Card', 'Gas Station', 'Fuel Stop', 'Service Station'],
    'Utilities': ['Power Company', 'Energy Provider', 'Water Utility', 'Telecom Provider', 'Internet Service'],
    'Entertainment': ['Streaming Service A', 'Music Streaming', 'Cinema Complex', 'Movie Theater', 'Video Service'],
    'Shopping': ['Department Store', 'Retail Shop', 'Electronics Store', 'Hardware Store', 'Fashion Outlet'],
    'Health': ['Pharmacy', 'Health Store', 'Fitness Center', 'Gym Membership'],
    'Income': ['Salary - ACME PTY LTD', 'Interest Credit']
}

def generate_transactions(start_date, end_date, account_type='checking'):
    """Generate realistic transactions with spending patterns."""
    transactions = []
    current_date = start_date
    balance = 5000.00 if account_type == 'checking' else 15000.00
    
    # Add monthly salary
    while current_date <= end_date:
        # Salary on 15th of each month
        if current_date.day == 15:
            salary = random.choice([4500.00, 4800.00, 5000.00])
            balance += salary
            transactions.append({
                'date': current_date.strftime('%d/%m/%Y'),
                'description': random.choice(MERCHANTS['Income']),
                'amount': salary,
                'balance': balance
            })
        
        # Random daily transactions
        if random.random() < 0.7:  # 70% chance of transaction each day
            num_transactions = random.randint(1, 4)
            
            for _ in range(num_transactions):
                # Pick category and merchant
                category = random.choice(list(MERCHANTS.keys()))
                if category == 'Income':
                    continue
                    
                merchant = random.choice(MERCHANTS[category])
                
                # Generate amount based on category
                if category == 'Groceries':
                    amount = -round(random.uniform(15, 180), 2)
                elif category == 'Dining':
                    amount = -round(random.uniform(8, 65), 2)
                elif category == 'Transportation':
                    amount = -round(random.uniform(5, 85), 2)
                elif category == 'Utilities':
                    amount = -round(random.uniform(50, 250), 2)
                elif category == 'Entertainment':
                    amount = -round(random.uniform(10, 45), 2)
                elif category == 'Shopping':
                    amount = -round(random.uniform(20, 350), 2)
                elif category == 'Health':
                    amount = -round(random.uniform(15, 120), 2)
                else:
                    amount = -round(random.uniform(10, 100), 2)
                
                balance += amount
                
                transactions.append({
                    'date': current_date.strftime('%d/%m/%Y'),
                    'description': merchant,
                    'amount': amount,
                    'balance': balance
                })
        
        current_date += timedelta(days=1)
    
    return transactions

def create_csv_statement(transactions, filename, bank_name):
    """Create CSV bank statement."""
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Date', 'Description', 'Amount', 'Balance'])
        
        for txn in transactions:
            writer.writerow([
                txn['date'],
                txn['description'],
                f"${txn['amount']:.2f}" if txn['amount'] >= 0 else f"-${abs(txn['amount']):.2f}",
                f"${txn['balance']:.2f}"
            ])

def create_pdf_statement(transactions, filename, bank_name, account_number, period):
    """Create PDF bank statement with Australian bank format."""
    doc = SimpleDocTemplate(filename, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Header
    header = Paragraph(f"<b>{bank_name}</b><br/>Transaction Statement", styles['Title'])
    elements.append(header)
    elements.append(Spacer(1, 10*mm))
    
    # Account info
    account_info = f"""
    <b>Account Number:</b> {account_number}<br/>
    <b>Statement Period:</b> {period}<br/>
    <b>Account Type:</b> Everyday Transaction Account<br/>
    """
    elements.append(Paragraph(account_info, styles['Normal']))
    elements.append(Spacer(1, 10*mm))
    
    # Transactions table
    table_data = [['Date', 'Description', 'Amount', 'Balance']]
    
    for txn in transactions:
        amount_str = f"${txn['amount']:.2f}" if txn['amount'] >= 0 else f"-${abs(txn['amount']):.2f}"
        balance_str = f"${txn['balance']:.2f}"
        
        table_data.append([
            txn['date'],
            txn['description'],
            amount_str,
            balance_str
        ])
    
    table = Table(table_data, colWidths=[30*mm, 80*mm, 30*mm, 30*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (3, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
    ]))
    
    elements.append(table)
    
    doc.build(elements)

def main():
    """Generate test statements."""
    print("Generating Australian bank statements for testing...")
    
    # Date range: 12 months ago to now (full year of data)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    
    # First Bank - Checking Account
    print("\n1. Generating First Bank statements...")
    bank1_transactions = generate_transactions(start_date, end_date, 'checking')
    
    # Split into 6 x 2-month statements (12 months total)
    months_per_statement = 60
    for i in range(6):
        statement_start = start_date + timedelta(days=i * months_per_statement)
        statement_end = statement_start + timedelta(days=months_per_statement - 1)
        
        statement_txns = [
            txn for txn in bank1_transactions
            if statement_start <= datetime.strptime(txn['date'], '%d/%m/%Y') <= statement_end
        ]
        
        period = f"{statement_start.strftime('%d %b %Y')} - {statement_end.strftime('%d %b %Y')}"
        
        # PDF
        pdf_filename = f"test-data/FirstBank_Statement_{statement_start.strftime('%b%Y')}.pdf"
        create_pdf_statement(
            statement_txns,
            pdf_filename,
            "First Bank Australia",
            "1234-5678-9012",
            period
        )
        print(f"   Created: {pdf_filename}")
        
        # CSV
        csv_filename = f"test-data/FirstBank_Statement_{statement_start.strftime('%b%Y')}.csv"
        create_csv_statement(statement_txns, csv_filename, "First Bank")
        print(f"   Created: {csv_filename}")
    
    # Second Bank - Savings Account
    print("\n2. Generating Second Bank statements...")
    bank2_transactions = generate_transactions(start_date, end_date, 'savings')
    
    for i in range(6):
        statement_start = start_date + timedelta(days=i * months_per_statement)
        statement_end = statement_start + timedelta(days=months_per_statement - 1)
        
        statement_txns = [
            txn for txn in bank2_transactions
            if statement_start <= datetime.strptime(txn['date'], '%d/%m/%Y') <= statement_end
        ]
        
        period = f"{statement_start.strftime('%d %b %Y')} - {statement_end.strftime('%d %b %Y')}"
        
        # PDF
        pdf_filename = f"test-data/SecondBank_Statement_{statement_start.strftime('%b%Y')}.pdf"
        create_pdf_statement(
            statement_txns,
            pdf_filename,
            "Second Bank Australia",
            "9876-5432-1098",
            period
        )
        print(f"   Created: {pdf_filename}")
        
        # CSV
        csv_filename = f"test-data/SecondBank_Statement_{statement_start.strftime('%b%Y')}.csv"
        create_csv_statement(statement_txns, csv_filename, "Second Bank")
        print(f"   Created: {csv_filename}")
    
    print("\n✅ Test statements generated successfully!")
    print("\nFiles created in test-data/ directory:")
    print("  - 12 PDF files (6 First Bank + 6 Second Bank)")
    print("  - 12 CSV files (6 First Bank + 6 Second Bank)")
    print("  - Covers 12 months of data (full year)")
    print("\nYou can now upload these to test:")
    print("  ✓ Multi-bank support")
    print("  ✓ Full year trend analysis")
    print("  ✓ Spending recommendations")
    print("  ✓ Anomaly detection")
    print("  ✓ Predictive alerts")
    print("  ✓ Conversational Q&A")

if __name__ == '__main__':
    main()
