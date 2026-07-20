import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableColumnRow } from './nodeShapes'

describe('TableColumnRow', () => {
  it('renders name and type with no badges when no flags are set', () => {
    render(<TableColumnRow column={{ name: 'label', type: 'varchar(255)' }} />)
    expect(screen.getByText('label')).toBeInTheDocument()
    expect(screen.getByText('varchar(255)')).toBeInTheDocument()
  })

  it('renders a PK badge', () => {
    render(<TableColumnRow column={{ name: 'id', type: 'uint', primaryKey: true }} />)
    expect(screen.getByText('PK')).toBeInTheDocument()
  })

  it('renders an FK badge with the referenced table.column', () => {
    render(<TableColumnRow column={{ name: 'user_id', type: 'uint', foreignKey: { table: 'users', column: 'id' } }} />)
    expect(screen.getByText('FK → users.id')).toBeInTheDocument()
  })

  it('combines multiple badges on one row, in PK/FK/UNIQUE/NULL order', () => {
    render(
      <TableColumnRow
        column={{
          name: 'email',
          type: 'text',
          primaryKey: true,
          foreignKey: { table: 'accounts', column: 'id' },
          unique: true,
          nullable: true,
        }}
      />
    )
    expect(screen.getByText('PK · FK → accounts.id · UNIQUE · NULL')).toBeInTheDocument()
  })
})
