import React, { useEffect, useMemo } from 'react';
import { UseFormRegisterReturn, UseFormSetValue } from 'react-hook-form';
import SearchableSelect from './ui/SearchableSelect';
import { getDistrictsByState, getAllStates } from '../data/indianStatesDistricts';

interface StateDistrictSelectorProps {
  stateValue: string;
  districtValue: string;
  stateRegister: UseFormRegisterReturn;
  districtRegister: UseFormRegisterReturn;
  setValue: UseFormSetValue<any>;
  stateError?: string;
  districtError?: string;
  disabled?: boolean;
  stateLabel?: string;
  districtLabel?: string;
  required?: boolean;
}

const StateDistrictSelector: React.FC<StateDistrictSelectorProps> = ({
  stateValue,
  districtValue,
  stateRegister,
  districtRegister,
  setValue,
  stateError,
  districtError,
  disabled = false,
  stateLabel = 'State',
  districtLabel = 'District',
  required = true,
}) => {
  // Get all states for the dropdown
  const stateOptions = useMemo(() => {
    const states = getAllStates();
    return [
      { value: '', label: 'Select State' },
      ...states.map(state => ({ value: state, label: state }))
    ];
  }, []);

  // Get districts based on selected state
  const districtOptions = useMemo(() => {
    if (!stateValue) {
      return [{ value: '', label: 'Select District' }];
    }
    const districts = getDistrictsByState(stateValue);
    return [
      { value: '', label: 'Select District' },
      ...districts.map(district => ({ value: district, label: district }))
    ];
  }, [stateValue]);

  // Reset district when state changes
  useEffect(() => {
    if (stateValue && districtValue) {
      const districts = getDistrictsByState(stateValue);
      // If current district is not in the new state's districts, reset it
      if (!districts.includes(districtValue)) {
        setValue(districtRegister.name, '');
      }
    } else if (!stateValue) {
      // If state is cleared, clear district too
      setValue(districtRegister.name, '');
    }
  }, [stateValue, districtValue, setValue, districtRegister.name]);

  return (
    <>
      <SearchableSelect
        label={stateLabel}
        options={stateOptions.filter(opt => opt.value !== '')} // Remove empty option for searchable
        value={stateValue || ''}
        onChange={(value) => {
          // Create a synthetic event for react-hook-form
          const event = {
            target: {
              value,
              name: stateRegister.name
            }
          } as React.ChangeEvent<HTMLInputElement>;
          stateRegister.onChange(event);
          // Clear district when state changes
          if (value !== stateValue) {
            setValue(districtRegister.name, '');
          }
        }}
        onBlur={stateRegister.onBlur}
        name={stateRegister.name}
        ref={stateRegister.ref}
        disabled={disabled}
        error={stateError}
        required={required}
        allowCustom={false}
        placeholder="Search or select state..."
        className="text-sm sm:text-base"
      />
      <SearchableSelect
        label={districtLabel}
        options={districtOptions.filter(opt => opt.value !== '')} // Remove empty option for searchable
        value={districtValue || ''}
        onChange={(value) => {
          // Create a synthetic event for react-hook-form
          const event = {
            target: {
              value,
              name: districtRegister.name
            }
          } as React.ChangeEvent<HTMLInputElement>;
          districtRegister.onChange(event);
        }}
        onBlur={districtRegister.onBlur}
        name={districtRegister.name}
        ref={districtRegister.ref}
        disabled={disabled || !stateValue}
        error={districtError}
        required={required}
        allowCustom={false}
        placeholder="Search or select district..."
        className="text-sm sm:text-base"
      />
    </>
  );
};

export default StateDistrictSelector;

