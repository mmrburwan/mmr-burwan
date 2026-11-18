import React, { useEffect, useMemo } from 'react';
import { UseFormRegisterReturn, UseFormSetValue } from 'react-hook-form';
import SearchableSelect from './ui/SearchableSelect';
import { getDistrictsByState, getAllStates } from '../data/indianStatesDistricts';

interface StateDistrictSelectorProps {
  stateValue?: string;
  districtValue?: string;
  stateRegister?: UseFormRegisterReturn;
  districtRegister?: UseFormRegisterReturn;
  setValue?: UseFormSetValue<any>;
  stateError?: string;
  districtError?: string;
  disabled?: boolean;
  stateLabel?: string;
  districtLabel?: string;
  required?: boolean;

  // Controlled component mode
  selectedState?: string;
  selectedDistrict?: string;
  onStateChange?: (state: string) => void;
  onDistrictChange?: (district: string) => void;
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
  selectedState,
  selectedDistrict,
  onStateChange,
  onDistrictChange,
}) => {
  const effectiveState = stateValue ?? selectedState ?? '';
  const effectiveDistrict = districtValue ?? selectedDistrict ?? '';

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
    if (!effectiveState) {
      return [{ value: '', label: 'Select District' }];
    }
    const districts = getDistrictsByState(effectiveState);
    return [
      { value: '', label: 'Select District' },
      ...districts.map(district => ({ value: district, label: district }))
    ];
  }, [effectiveState]);

  // Reset district when state changes
  useEffect(() => {
    if (effectiveState && effectiveDistrict) {
      const districts = getDistrictsByState(effectiveState);
      // If current district is not in the new state's districts, reset it
      if (!districts.includes(effectiveDistrict)) {
        if (districtRegister?.name && setValue) {
          setValue(districtRegister.name, '', { shouldValidate: true, shouldDirty: true });
        }
        if (onDistrictChange) {
          onDistrictChange('');
        }
      }
    } else if (!effectiveState && effectiveDistrict) {
      // If state is cleared, clear district too
      if (districtRegister?.name && setValue) {
        setValue(districtRegister.name, '', { shouldValidate: true, shouldDirty: true });
      }
      if (onDistrictChange) {
        onDistrictChange('');
      }
    }
  }, [effectiveState, effectiveDistrict, setValue, districtRegister?.name, onDistrictChange]);

  const handleStateChange = (value: string) => {
    if (stateRegister?.onChange) {
      const event = {
        target: {
          value,
          name: stateRegister.name
        }
      } as React.ChangeEvent<HTMLInputElement>;
      stateRegister.onChange(event);
    }
    if (setValue && stateRegister?.name) {
      setValue(stateRegister.name, value, { shouldValidate: true, shouldDirty: true });
    }
    if (onStateChange) {
      onStateChange(value);
    }
    // Clear district when state changes
    if (value !== effectiveState) {
        if (setValue && districtRegister?.name) {
          setValue(districtRegister.name, '', { shouldValidate: true, shouldDirty: true });
        }
        if (onDistrictChange) {
          onDistrictChange('');
        }
      }
    };

    const handleDistrictChange = (value: string) => {
      if (districtRegister?.onChange) {
        const event = {
          target: {
            value,
            name: districtRegister.name
          }
        } as React.ChangeEvent<HTMLInputElement>;
        districtRegister.onChange(event);
      }
      if (setValue && districtRegister?.name) {
        setValue(districtRegister.name, value, { shouldValidate: true, shouldDirty: true });
      }
      if (onDistrictChange) {
        onDistrictChange(value);
      }
    };

    return (
      <>
        <SearchableSelect
          label={stateLabel}
          options={stateOptions.filter(opt => opt.value !== '')} // Remove empty option for searchable
          value={effectiveState}
          onChange={handleStateChange}
          onBlur={stateRegister?.onBlur}
          name={stateRegister?.name || 'state'}
          ref={stateRegister?.ref}
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
          value={effectiveDistrict}
          onChange={handleDistrictChange}
          onBlur={districtRegister?.onBlur}
          name={districtRegister?.name || 'district'}
          ref={districtRegister?.ref}
          disabled={disabled || !effectiveState}
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

